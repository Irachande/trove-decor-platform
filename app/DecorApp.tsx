"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type View = "home" | "storage" | "calendar" | "network" | "profile" | "plans";
type ItemStatus = "Available" | "Reserved" | "Rented";
type Language = "pt" | "en";
type Translator = (pt: string, en: string) => string;
type WorkspaceRole = "owner" | "manager" | "inventory" | "reservations" | "viewer";

type SessionUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

type Workspace = {
  id: number;
  name: string;
  handle: string;
  role: WorkspaceRole;
  plan: "Basic" | "Network";
};

type Member = {
  id: number;
  email: string;
  displayName?: string;
  role: string;
  status: string;
};

type Item = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  available: number;
  status: ItemStatus;
  tone: string;
  symbol: string;
  price: number;
  currency: string;
  photoUrl?: string;
  storageLocation: string;
  condition: string;
  description: string;
  sku: string;
  replacementValue: number;
  minStock: number;
};

type ItemPhoto = { id: number; itemId: number; url: string; sortOrder: number };
type StockMovement = { id: number; itemId: number; type: string; quantityDelta: number; note: string; createdAt: string };
type MaintenanceRecord = { id: number; itemId: number; type: string; status: string; notes: string; cost: number; scheduledDate: string; completedAt?: string; createdAt: string };
type KitEntry = { id: number; kitId: number; itemId: number; quantity: number };
type Kit = { id: number; name: string; description: string; price: number; currency: string; active: boolean; createdAt: string; items: KitEntry[] };
type ImportReport = { title: string; detail: string; errors: string[] };
type WorkspaceData = {
  items?: Item[];
  reservations?: Reservation[];
  categories?: { name: string }[];
  profile?: Partial<Profile>;
  workspace?: Workspace;
  members?: Member[];
  photos?: ItemPhoto[];
  movements?: StockMovement[];
  maintenance?: MaintenanceRecord[];
  kits?: Kit[];
};

type Reservation = {
  id: number;
  item: string;
  client: string;
  date: string;
  endDate: string;
  color: string;
  eventName: string;
  contact: string;
  notes: string;
  quantity: number;
  status: string;
};

type Profile = {
  businessName: string;
  handle: string;
  bio: string;
  location: string;
  phone: string;
  email: string;
  color: string;
  avatarUrl?: string;
};

const seedProfile: Profile = {
  businessName: "Trove Studio",
  handle: "trove-studio",
  bio: "",
  location: "Maputo, Moçambique",
  phone: "",
  email: "",
  color: "#b75d3f",
};

const networkItems = [
  { name: "Cadeira Ghost transparente", owner: "Aster Events", distance: "2,4 km", available: 42, price: "450 MZN / dia", symbol: "CG", tone: "mist", rating: "4.9" },
  { name: "Candeeiro de mesa em latão", owner: "Gather & Glow", distance: "4,8 km", available: 12, price: "1 050 MZN / dia", symbol: "CL", tone: "gold", rating: "4.8" },
  { name: "Tenda sailcloth branca", owner: "Marée Rentals", distance: "8,1 km", available: 2, price: "15 500 MZN / dia", symbol: "TS", tone: "ivory", rating: "5.0" },
  { name: "Conjunto lounge em cana", owner: "Olive House", distance: "11 km", available: 3, price: "5 500 MZN / dia", symbol: "LC", tone: "sage", rating: "4.7" },
];

function formatMoney(value: number, currency = "MZN", language: Language = "pt") {
  return new Intl.NumberFormat(language === "pt" ? "pt-MZ" : "en-MZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function navItems(t: Translator): { id: View; label: string; icon: string }[] {
  return [
    { id: "home", label: t("Visão geral", "Overview"), icon: "⌂" },
    { id: "storage", label: t("Inventário", "Inventory"), icon: "▦" },
    { id: "calendar", label: t("Calendário", "Calendar"), icon: "□" },
    { id: "network", label: t("Rede local", "Nearby network"), icon: "◎" },
    { id: "profile", label: t("Perfil público", "Public profile"), icon: "◇" },
  ];
}

function cls(...names: (string | false | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

function initials(value: string) {
  return value.split(/\s+|@/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function roleLabel(role: string, t: Translator) {
  if (role === "owner") return t("Proprietária", "Owner");
  if (role === "manager") return t("Gestor", "Manager");
  if (role === "inventory") return t("Inventário", "Inventory");
  if (role === "reservations") return t("Reservas", "Reservations");
  return t("Consulta", "Viewer");
}

export default function DecorApp({ initialUser }: { initialUser: SessionUser }) {
  const [view, setView] = useState<View>("home");
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "pt";
    const saved = window.localStorage.getItem("trove-language");
    return saved === "en" ? "en" : "pt";
  });
  const [items, setItems] = useState<Item[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile>({ ...seedProfile, email: initialUser.email });
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [photos, setPhotos] = useState<ItemPhoto[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All items");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sort, setSort] = useState("name");
  const [addOpen, setAddOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [managedItem, setManagedItem] = useState<Item | null>(null);
  const [kitsOpen, setKitsOpen] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [networkQuery, setNetworkQuery] = useState("");
  const [requested, setRequested] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<"Basic" | "Network">("Basic");
  const [reloadToken, setReloadToken] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const t: Translator = (pt, en) => language === "pt" ? pt : en;
  const navigation = navItems(t);
  const role = workspace?.role || "viewer";
  const canManageInventory = ["owner", "manager", "inventory"].includes(role);
  const canManageReservations = ["owner", "manager", "reservations"].includes(role);
  const canManageTeam = ["owner", "manager"].includes(role);
  const canManageProfile = ["owner", "manager"].includes(role);

  useEffect(() => {
    fetch("/api/data")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((raw) => {
        const data = raw as WorkspaceData;
        if (Array.isArray(data.items)) setItems(data.items);
        if (Array.isArray(data.reservations)) setReservations(data.reservations);
        if (Array.isArray(data.categories)) setCategories(data.categories.map((entry: { name: string }) => entry.name));
        if (data.profile) setProfile({ ...seedProfile, ...data.profile });
        if (data.workspace) {
          setWorkspace(data.workspace);
          setPlan(data.workspace.plan);
        }
        if (Array.isArray(data.members)) setMembers(data.members);
        if (Array.isArray(data.photos)) setPhotos(data.photos);
        if (Array.isArray(data.movements)) setMovements(data.movements);
        if (Array.isArray(data.maintenance)) setMaintenance(data.maintenance);
        if (Array.isArray(data.kits)) setKits(data.kits);
      })
      .catch(() => {
        setToast("Não foi possível carregar o espaço da empresa.");
      });
  }, [reloadToken]);

  function changeLanguage(next: Language) {
    setLanguage(next);
    window.localStorage.setItem("trove-language", next);
  }

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredItems = useMemo(() => {
    const normalized = query.toLowerCase();
    return items.filter((item) => {
      const matchesQuery = `${item.name} ${item.category}`.toLowerCase().includes(normalized);
      const matchesFilter = filter === "All items" || item.status === filter;
      const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
      return matchesQuery && matchesFilter && matchesCategory;
    }).sort((a, b) => {
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      if (sort === "available") return b.available - a.available;
      return a.name.localeCompare(b.name);
    });
  }, [items, query, filter, categoryFilter, sort]);

  const filteredNetwork = useMemo(() => {
    const normalized = networkQuery.toLowerCase();
    return networkItems.filter((item) =>
      `${item.name} ${item.owner}`.toLowerCase().includes(normalized),
    );
  }, [networkQuery]);

  const showToast = (message: string) => setToast(message);

  async function persist(action: string, payload: unknown) {
    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (response.status === 401) {
        window.location.href = "/signin-with-chatgpt?return_to=%2F";
        return false;
      }
      if (!response.ok) throw new Error(result.error || "Unable to save");
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Não foi possível guardar.", "Unable to save."));
      return false;
    }
  }

  async function uploadItemPhotos(files: File[]) {
    const urls: string[] = [];
    for (const file of files.slice(0, 8)) {
      try {
        const upload = new FormData();
        upload.append("file", file);
        const response = await fetch("/api/item-image", { method: "POST", body: upload });
        if (!response.ok) throw new Error();
        urls.push(((await response.json()) as { url: string }).url);
      } catch {
        showToast(t("Algumas fotografias não foram carregadas.", "Some photos could not be uploaded."));
        break;
      }
    }
    return urls;
  }

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const category = String(form.get("category") || categories[0] || t("Sem categoria", "Uncategorized"));
    const quantity = Number(form.get("quantity") || 1);
    if (!name) return;
    let photoUrls: string[] = [];
    const photoFiles = form.getAll("photo").filter((value): value is File => value instanceof File && value.size > 0);
    photoUrls = await uploadItemPhotos(photoFiles);
    const item: Item = {
      id: Date.now(),
      name,
      category,
      quantity,
      available: quantity,
      status: "Available",
      tone: "clay",
      symbol: name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase(),
      price: Number(form.get("price") || 0),
      currency: String(form.get("currency") || "MZN"),
      photoUrl: photoUrls[0] || "",
      storageLocation: String(form.get("location") || ""),
      condition: String(form.get("condition") || t("Bom", "Good")),
      description: String(form.get("description") || ""),
      sku: String(form.get("sku") || ""),
      replacementValue: Number(form.get("replacementValue") || 0),
      minStock: Number(form.get("minStock") || 0),
    };
    if (await persist("addItem", item)) {
      if (photoUrls.length > 1) {
        await persist("addItemPhotos", { itemId: item.id, urls: photoUrls.slice(1) });
      }
      setItems((current) => [item, ...current]);
      setAddOpen(false);
      setReloadToken((value) => value + 1);
      showToast(t(`${name} adicionado ao inventário`, `${name} added to Inventory`));
    }
  }

  async function handleReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const itemId = Number(form.get("itemId") || selectedItem?.id);
    const itemForReservation = items.find((item) => item.id === itemId);
    if (!itemForReservation) return;
    const quantity = Number(form.get("quantity") || 1);
    const reservation: Reservation = {
      id: Date.now(),
      item: `${itemForReservation.name} × ${quantity}`,
      client: String(form.get("client") || t("Nova reserva", "New reservation")),
      eventName: String(form.get("eventName") || ""),
      contact: String(form.get("contact") || ""),
      notes: String(form.get("notes") || ""),
      date: String(form.get("start")),
      endDate: String(form.get("end")),
      color: profile.color,
      quantity,
      status: "Confirmed",
    };
    setReservations((current) => [reservation, ...current]);
    setItems((current) => current.map((item) => item.id === itemForReservation.id ? { ...item, status: "Reserved" } : item));
    setReserveOpen(false);
    showToast(t(`Datas reservadas para ${itemForReservation.name}`, `Dates reserved for ${itemForReservation.name}`));
    await persist("addReservation", reservation);
  }

  async function saveProfile() {
    setSaving(true);
    await persist("updateProfile", profile);
    window.setTimeout(() => {
      setSaving(false);
      showToast(t("Perfil público actualizado", "Public profile updated"));
    }, 450);
  }

  function openReserve(item: Item) {
    if (!canManageReservations) {
      showToast(t("A sua função não permite criar reservas.", "Your role cannot create reservations."));
      return;
    }
    setSelectedItem(item);
    setReserveOpen(true);
  }

  async function addCategory(name: string) {
    const clean = name.trim();
    if (!clean || categories.includes(clean)) return;
    setCategories((current) => [...current, clean].sort());
    await persist("addCategory", { id: Date.now(), name: clean });
    showToast(t("Categoria adicionada", "Category added"));
  }

  async function removeCategory(name: string) {
    const fallback = t("Sem categoria", "Uncategorized");
    setCategories((current) => current.filter((entry) => entry !== name));
    setItems((current) => current.map((item) => item.category === name ? { ...item, category: fallback } : item));
    await persist("removeCategory", { name, fallback });
    showToast(t("Categoria removida; os itens foram movidos.", "Category removed; its items were moved."));
  }

  async function bulkStatus(ids: number[], status: ItemStatus) {
    setItems((current) => current.map((item) => ids.includes(item.id) ? { ...item, status } : item));
    await persist("bulkStatus", { ids: ids.join(","), status });
    showToast(t(`${ids.length} itens actualizados`, `${ids.length} items updated`));
  }

  async function bulkRemove(ids: number[]) {
    setItems((current) => current.filter((item) => !ids.includes(item.id)));
    await persist("bulkRemove", { ids: ids.join(",") });
    showToast(t(`${ids.length} itens removidos`, `${ids.length} items removed`));
  }

  async function updateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!managedItem) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity"));
    const available = Math.min(quantity, Number(form.get("available")));
    const updated: Item = {
      ...managedItem,
      name: String(form.get("name") || "").trim(),
      category: String(form.get("category") || ""),
      quantity,
      available,
      status: String(form.get("status") || "Available") as ItemStatus,
      price: Number(form.get("price") || 0),
      currency: String(form.get("currency") || "MZN"),
      storageLocation: String(form.get("storageLocation") || ""),
      condition: String(form.get("condition") || ""),
      description: String(form.get("description") || ""),
      sku: String(form.get("sku") || ""),
      replacementValue: Number(form.get("replacementValue") || 0),
      minStock: Number(form.get("minStock") || 0),
    };
    if (await persist("updateItem", updated)) {
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      setManagedItem(updated);
      setReloadToken((value) => value + 1);
      showToast(t("Ficha do artigo actualizada", "Item record updated"));
    }
  }

  async function addPhotosToItem(files: File[]) {
    if (!managedItem || !files.length) return;
    const currentCount = photos.filter((photo) => photo.itemId === managedItem.id).length;
    if (currentCount + files.length > 8) {
      showToast(t("Cada artigo pode ter até 8 fotografias.", "Each item can have up to 8 photos."));
      return;
    }
    const urls = await uploadItemPhotos(files);
    if (urls.length && await persist("addItemPhotos", { itemId: managedItem.id, urls })) {
      setReloadToken((value) => value + 1);
      showToast(t("Galeria actualizada", "Gallery updated"));
    }
  }

  async function removePhoto(photo: ItemPhoto) {
    if (await persist("removeItemPhoto", { id: photo.id })) {
      setReloadToken((value) => value + 1);
      showToast(t("Fotografia removida", "Photo removed"));
    }
  }

  async function adjustItemStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!managedItem) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const delta = Number(form.get("delta"));
    if (await persist("adjustStock", {
      id: Date.now(),
      itemId: managedItem.id,
      delta,
      type: String(form.get("type") || "adjustment"),
      note: String(form.get("note") || ""),
    })) {
      setManagedItem({ ...managedItem, quantity: managedItem.quantity + delta, available: managedItem.available + delta });
      setReloadToken((value) => value + 1);
      formElement.reset();
      showToast(t("Movimento de stock registado", "Stock movement recorded"));
    }
  }

  async function addMaintenanceRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!managedItem) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (await persist("addMaintenance", {
      id: Date.now(),
      itemId: managedItem.id,
      type: String(form.get("type")),
      status: "Open",
      notes: String(form.get("notes") || ""),
      cost: Number(form.get("cost") || 0),
      scheduledDate: String(form.get("scheduledDate") || ""),
      condition: t("Em manutenção", "In maintenance"),
    })) {
      setReloadToken((value) => value + 1);
      formElement.reset();
      showToast(t("Intervenção registada", "Maintenance record added"));
    }
  }

  async function completeMaintenance(record: MaintenanceRecord) {
    if (await persist("updateMaintenance", { id: record.id, status: "Completed" })) {
      setReloadToken((value) => value + 1);
      showToast(t("Intervenção concluída", "Maintenance completed"));
    }
  }

  async function createKit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const entries = items.flatMap((item) => {
      const selected = form.get(`kit-item-${item.id}`);
      const quantity = Number(form.get(`kit-quantity-${item.id}`) || 1);
      return selected ? [{ itemId: item.id, quantity }] : [];
    });
    if (!entries.length) {
      showToast(t("Seleccione pelo menos um artigo para o kit.", "Select at least one item for the kit."));
      return;
    }
    if (await persist("createKit", {
      id: Date.now(),
      name: String(form.get("name")),
      description: String(form.get("description") || ""),
      price: Number(form.get("price") || 0),
      currency: "MZN",
      items: entries,
    })) {
      setReloadToken((value) => value + 1);
      formElement.reset();
      showToast(t("Kit criado", "Kit created"));
    }
  }

  async function deleteKit(kit: Kit) {
    if (await persist("deleteKit", { id: kit.id })) {
      setKits((current) => current.filter((entry) => entry.id !== kit.id));
      showToast(t("Kit removido", "Kit removed"));
    }
  }

  function exportInventory() {
    const header = ["name", "category", "quantity", "available", "status", "price", "currency", "location", "condition"];
    const rows = items.map((item) => [item.name, item.category, item.quantity, item.available, item.status, item.price, item.currency, item.storageLocation, item.condition]);
    downloadCsv("trove-inventario.csv", [header, ...rows]);
    showToast(t("Inventário exportado para CSV", "Inventory exported to CSV"));
  }

  async function importInventory(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      let matrix: unknown[][];
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { default: readXlsxFile } = await import("read-excel-file");
        matrix = await readXlsxFile(file);
      } else {
        const content = await file.text();
        matrix = content.split(/\r?\n/).filter(Boolean).map(parseCsvRow);
      }
      const headers = (matrix[0] || []).map((value) => String(value || "").trim().toLowerCase());
      const required = ["name", "category", "quantity"];
      const missing = required.filter((header) => !headers.includes(header));
      if (missing.length) {
        setImportReport({
          title: t("Ficheiro não importado", "File not imported"),
          detail: t(`Faltam colunas obrigatórias: ${missing.join(", ")}.`, `Missing required columns: ${missing.join(", ")}.`),
          errors: [],
        });
        return;
      }
      const valueAt = (row: unknown[], name: string) => row[headers.indexOf(name)];
      const errors: string[] = [];
      const imported: Item[] = matrix.slice(1).filter((row) => row.some((value) => String(value ?? "").trim())).flatMap((row, index) => {
        const line = index + 2;
        const name = String(valueAt(row, "name") || "").trim();
        const category = String(valueAt(row, "category") || "").trim();
        const quantity = Number(valueAt(row, "quantity"));
        const availableValue = valueAt(row, "available");
        const available = availableValue === undefined || availableValue === "" ? quantity : Number(availableValue);
        const price = Number(valueAt(row, "price") || 0);
        if (!name) errors.push(t(`Linha ${line}: nome em falta.`, `Row ${line}: missing name.`));
        if (!category) errors.push(t(`Linha ${line}: categoria em falta.`, `Row ${line}: missing category.`));
        if (!Number.isSafeInteger(quantity) || quantity < 1) errors.push(t(`Linha ${line}: quantidade inválida.`, `Row ${line}: invalid quantity.`));
        if (!Number.isSafeInteger(available) || available < 0 || available > quantity) errors.push(t(`Linha ${line}: disponibilidade inválida.`, `Row ${line}: invalid availability.`));
        if (!Number.isSafeInteger(price) || price < 0) errors.push(t(`Linha ${line}: preço inválido.`, `Row ${line}: invalid price.`));
        if (!name || !category || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(available) || available < 0 || available > quantity || !Number.isSafeInteger(price) || price < 0) return [];
        const statusValue = String(valueAt(row, "status") || "Available");
        return [{
          id: Date.now() + index,
          name,
          category,
          quantity,
          available,
          status: (["Available", "Reserved", "Rented"].includes(statusValue) ? statusValue : "Available") as ItemStatus,
          price,
          currency: String(valueAt(row, "currency") || "MZN").toUpperCase(),
          storageLocation: String(valueAt(row, "location") || ""),
          condition: String(valueAt(row, "condition") || t("Bom", "Good")),
          description: String(valueAt(row, "description") || ""),
          sku: String(valueAt(row, "sku") || ""),
          replacementValue: Number(valueAt(row, "replacementvalue") || 0),
          minStock: Number(valueAt(row, "minstock") || 0),
          tone: "sand",
          symbol: initials(name),
        }];
      });
      if (errors.length) {
        setImportReport({
          title: t("Validação encontrou erros", "Validation found errors"),
          detail: t("Nenhum artigo foi gravado. Corrija o ficheiro e tente novamente.", "No items were saved. Fix the file and try again."),
          errors: errors.slice(0, 30),
        });
        return;
      }
      if (!imported.length) throw new Error(t("O ficheiro não contém artigos.", "The file contains no items."));
      if (await persist("importItems", { items: imported })) {
        setImportReport({
          title: t("Importação concluída", "Import complete"),
          detail: t(`${imported.length} artigos foram validados e importados.`, `${imported.length} items were validated and imported.`),
          errors: [],
        });
        setReloadToken((value) => value + 1);
      }
    } catch (error) {
      setImportReport({
        title: t("Não foi possível ler o ficheiro", "Could not read the file"),
        detail: error instanceof Error ? error.message : t("Use um ficheiro CSV ou XLSX válido.", "Use a valid CSV or XLSX file."),
        errors: [],
      });
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main className="app-shell" style={{ "--brand": profile.color } as React.CSSProperties}>
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("home")} aria-label="Trove home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Trove</span>
        </button>
        <div className="workspace-chip">
          <span className="workspace-avatar">{initials(workspace?.name || profile.businessName).slice(0, 1)}</span>
          <span><strong>{workspace?.name || profile.businessName}</strong><small>{plan} plan</small></span>
          <b title={roleLabel(role, t)}>●</b>
        </div>
        <nav aria-label={t("Navegação principal", "Primary navigation")}>
          {navigation.map((item) => (
            <button key={item.id} onClick={() => setView(item.id)} className={cls(view === item.id && "active")}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.id === "network" && <em>PRO</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => setView("plans")} className={cls("plan-card", view === "plans" && "active")}>
            <span className="plan-orbit">✦</span>
            <span><strong>{t("Plano", "Plan")} {plan}</strong><small>{plan === "Network" ? t("Equipa ilimitada · Aluguer local", "Unlimited team · Local rentals") : t("Gestão essencial", "Inventory essentials")}</small></span>
            <span>›</span>
          </button>
          <div className="user-row">
            <span className="user-avatar">{initials(initialUser.displayName)}</span>
            <button onClick={() => setView("profile")}><strong>{initialUser.displayName}</strong><small>{roleLabel(role, t)}</small></button>
            <a href="/signout-with-chatgpt?return_to=%2F" aria-label={t("Terminar sessão", "Sign out")} title={t("Terminar sessão", "Sign out")}>↗</a>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <button className="mobile-logo" onClick={() => setView("home")}><span className="brand-mark"><i /><i /><i /></span>Trove</button>
          <div className="topbar-actions">
            <label className="language-picker" aria-label={t("Idioma", "Language")}><span>文</span><select value={language} onChange={(event) => changeLanguage(event.target.value as Language)}><option value="pt">PT</option><option value="en">EN</option></select></label>
            <button className="icon-button" aria-label={t("Pesquisar", "Search")} onClick={() => setView("storage")}>⌕</button>
            <button className="icon-button notification" aria-label={t("Notificações", "Notifications")}>♢<i /></button>
            <div className="team-faces" aria-label={t(`${members.length} membros da equipa`, `${members.length} team members`)}>
              {members.slice(0, 3).map((member) => <span key={`${member.id}-${member.email}`}>{initials(member.displayName || member.email)}</span>)}
              {canManageTeam && <button onClick={() => setTeamOpen(true)} aria-label={t("Convidar colaborador", "Invite teammate")}>+</button>}
            </div>
          </div>
        </header>

        <div className="page-content">
          {view === "home" && (
            <Overview
              language={language}
              t={t}
              items={items}
              reservations={reservations}
              userName={initialUser.fullName || initialUser.displayName.split("@")[0]}
              setView={setView}
              openAdd={() => canManageInventory ? setAddOpen(true) : showToast(t("A sua função não permite alterar o inventário.", "Your role cannot change inventory."))}
              openReserve={openReserve}
            />
          )}
          {view === "storage" && (
            <Storage
              items={filteredItems}
              allItems={items}
              language={language}
              t={t}
              categories={categories}
              query={query}
              setQuery={setQuery}
              filter={filter}
              setFilter={setFilter}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              sort={sort}
              setSort={setSort}
              openAdd={() => canManageInventory ? setAddOpen(true) : showToast(t("A sua função não permite alterar o inventário.", "Your role cannot change inventory."))}
              openCategories={() => canManageInventory ? setCategoryOpen(true) : showToast(t("A sua função não permite gerir categorias.", "Your role cannot manage categories."))}
              openReserve={openReserve}
              exportInventory={exportInventory}
              importInventory={() => importRef.current?.click()}
              openKits={() => canManageInventory ? setKitsOpen(true) : showToast(t("A sua função não permite gerir kits.", "Your role cannot manage kits."))}
              manageItem={(item) => canManageInventory ? setManagedItem(item) : showToast(t("A sua função permite apenas consultar.", "Your role is view-only."))}
              bulkStatus={bulkStatus}
              bulkRemove={bulkRemove}
              removeItem={(item) => {
                setItems((current) => current.filter((candidate) => candidate.id !== item.id));
                persist("removeItem", { id: item.id });
                showToast(t(`${item.name} removido`, `${item.name} removed`));
              }}
            />
          )}
          {view === "calendar" && <Calendar language={language} t={t} reservations={reservations} openAdd={() => { if (canManageReservations) { setSelectedItem(null); setReserveOpen(true); } else showToast(t("A sua função não permite criar reservas.", "Your role cannot create reservations.")); }} />}
          {view === "network" && (
            <Network
              plan={plan}
              t={t}
              query={networkQuery}
              setQuery={setNetworkQuery}
              items={filteredNetwork}
              requested={requested}
              onRequest={(name) => {
                setRequested((current) => [...current, name]);
                showToast(t(`Pedido enviado para ${name}`, `Request sent for ${name}`));
              }}
              openPlans={() => setView("plans")}
            />
          )}
          {view === "profile" && <ProfileEditor t={t} profile={profile} setProfile={setProfile} save={canManageProfile ? saveProfile : () => showToast(t("A sua função não permite editar o perfil.", "Your role cannot edit the profile."))} saving={saving} />}
          {view === "plans" && <Plans t={t} plan={plan} choose={(next) => { setPlan(next); showToast(t(`Plano ${next} seleccionado`, `${next} plan selected`)); }} />}
        </div>
      </section>

      <nav className="mobile-nav" aria-label={t("Navegação móvel", "Mobile navigation")}>
        {navigation.slice(0, 4).map((item) => (
          <button key={item.id} className={cls(view === item.id && "active")} onClick={() => setView(item.id)}>
            <span>{item.icon}</span><small>{item.id === "network" ? t("Rede", "Network") : item.label}</small>
          </button>
        ))}
        <button className={cls(view === "profile" && "active")} onClick={() => setView("profile")}><span>◇</span><small>{t("Perfil", "Profile")}</small></button>
      </nav>
      <input className="visually-hidden" ref={importRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importInventory} />

      {addOpen && (
        <Modal title={t("Adicionar ao inventário", "Add to Inventory")} subtitle={t("Crie uma ficha completa que toda a equipa consegue consultar.", "Create a complete record your whole team can see.")} onClose={() => setAddOpen(false)}>
          <form onSubmit={handleAddItem} className="modal-form">
            <label>{t("Fotografias do item", "Item photos")}<span className="photo-upload-field"><span>▧</span><span><strong>{t("Carregar até 8 fotografias", "Upload up to 8 photos")}</strong><small>JPG ou PNG · máx. 5 MB cada</small></span><input name="photo" type="file" multiple accept="image/png,image/jpeg" /></span></label>
            <label>{t("Nome do item", "Item name")}<input name="name" placeholder={t("ex.: Plinto de travertino", "e.g. Travertine plinth")} autoFocus required /></label>
            <label>{t("Descrição", "Description")}<textarea name="description" rows={3} placeholder={t("Dimensões, materiais e cuidados especiais…", "Dimensions, materials, and special care…")} /></label>
            <div className="form-grid">
              <label>{t("Categoria", "Category")}<select name="category">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>SKU<input name="sku" placeholder="CAD-001" /></label>
            </div>
            <div className="form-grid">
              <label>{t("Quantidade", "Quantity")}<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
              <label>{t("Stock mínimo", "Minimum stock")}<input name="minStock" type="number" min="0" defaultValue="0" /></label>
            </div>
            <div className="form-grid">
              <label>{t("Preço de aluguer / dia", "Rental price / day")}<input name="price" type="number" min="0" defaultValue="500" required /></label>
              <label>{t("Moeda", "Currency")}<select name="currency" defaultValue="MZN"><option value="MZN">MZN · Metical</option><option value="ZAR">ZAR · Rand</option><option value="USD">USD · Dollar</option><option value="EUR">EUR · Euro</option></select></label>
            </div>
            <label>{t("Valor de reposição (MZN)", "Replacement value (MZN)")}<input name="replacementValue" type="number" min="0" defaultValue="0" /></label>
            <div className="form-grid">
              <label>{t("Localização no armazém", "Storage location")}<input name="location" placeholder={t("Corredor B · Prateleira 04", "Aisle B · Shelf 04")} /></label>
              <label>{t("Condição", "Condition")}<select name="condition"><option>{t("Excelente", "Excellent")}</option><option>{t("Bom", "Good")}</option><option>{t("Requer inspecção", "Needs inspection")}</option><option>{t("Em manutenção", "In maintenance")}</option></select></label>
            </div>
            <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setAddOpen(false)}>{t("Cancelar", "Cancel")}</button><button className="button-primary">{t("Adicionar item", "Add item")}</button></div>
          </form>
        </Modal>
      )}

      {reserveOpen && (
        <Modal title={t("Nova reserva", "New reservation")} subtitle={selectedItem?.name || t("Escolha o item e registe os detalhes do evento.", "Choose the item and record the event details.")} onClose={() => setReserveOpen(false)}>
          <form onSubmit={handleReservation} className="modal-form">
            <label>{t("Item", "Item")}<select name="itemId" defaultValue={selectedItem?.id || items[0]?.id}>{categories.map((category) => <optgroup label={category} key={category}>{items.filter((item) => item.category === category).map((item) => <option value={item.id} key={item.id}>{item.name} · {item.available} {t("disponíveis", "available")}</option>)}</optgroup>)}</select></label>
            <div className="form-grid">
              <label>{t("Evento", "Event")}<input name="eventName" placeholder={t("ex.: Casamento Rivera", "e.g. Rivera wedding")} required /></label>
              <label>{t("Cliente", "Client")}<input name="client" placeholder={t("Nome do cliente", "Client name")} required /></label>
            </div>
            <label>{t("Contacto do cliente", "Client contact")}<input name="contact" placeholder="+258 84 000 0000" /></label>
            <div className="form-grid">
              <label>{t("Data de início", "Start date")}<input name="start" type="date" defaultValue="2026-08-08" required /></label>
              <label>{t("Data de fim", "End date")}<input name="end" type="date" defaultValue="2026-08-09" required /></label>
            </div>
            <label>{t("Quantidade", "Quantity")}<input name="quantity" type="number" min="1" max={selectedItem?.available || 999} defaultValue="1" required /></label>
            <label>{t("Notas de logística", "Logistics notes")}<textarea name="notes" rows={3} placeholder={t("Horário de recolha, endereço, responsável, cuidados especiais…", "Pickup time, address, owner, special handling…")} /></label>
            <div className="availability-note"><span>✓</span> {selectedItem?.available || items[0]?.available || 0} {t("unidades disponíveis neste momento", "units currently available")}</div>
            <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setReserveOpen(false)}>{t("Cancelar", "Cancel")}</button><button className="button-primary">{t("Confirmar reserva", "Confirm reservation")}</button></div>
          </form>
        </Modal>
      )}

      {categoryOpen && (
        <Modal title={t("Gerir categorias", "Manage categories")} subtitle={t("Adicione, renomeie a organização ou remova categorias que já não usa.", "Add new organization options or remove categories you no longer use.")} onClose={() => setCategoryOpen(false)}>
          <CategoryManager t={t} categories={categories} addCategory={addCategory} removeCategory={removeCategory} />
        </Modal>
      )}

      {teamOpen && (
        <Modal title={t("Equipa e permissões", "Team & permissions")} subtitle={t("Convide colaboradores e defina quem pode editar, reservar ou apenas consultar.", "Invite collaborators and choose who can edit, reserve, or only view.")} onClose={() => setTeamOpen(false)}>
          <TeamManager
            t={t}
            members={members}
            canInvite={canManageTeam}
            onInvite={async (email, role) => {
              const id = Date.now();
              if (await persist("inviteMember", { id, email, role })) {
                setMembers((current) => [...current.filter((member) => member.email.toLowerCase() !== email.toLowerCase()), { id, email, role, status: "Pending" }]);
                showToast(t("Convite registado como pendente", "Invitation recorded as pending"));
              }
            }}
          />
        </Modal>
      )}

      {managedItem && (
        <Modal wide title={managedItem.name} subtitle={t("Ficha operacional, galeria, stock e manutenção.", "Operational record, gallery, stock, and maintenance.")} onClose={() => setManagedItem(null)}>
          <ItemManager
            item={managedItem}
            categories={categories}
            photos={photos.filter((photo) => photo.itemId === managedItem.id)}
            movements={movements.filter((movement) => movement.itemId === managedItem.id)}
            maintenance={maintenance.filter((record) => record.itemId === managedItem.id)}
            language={language}
            t={t}
            onUpdate={updateItem}
            onAddPhotos={addPhotosToItem}
            onRemovePhoto={removePhoto}
            onAdjustStock={adjustItemStock}
            onAddMaintenance={addMaintenanceRecord}
            onCompleteMaintenance={completeMaintenance}
          />
        </Modal>
      )}

      {kitsOpen && (
        <Modal wide title={t("Kits e conjuntos", "Kits & sets")} subtitle={t("Agrupe artigos alugados em conjunto e defina um preço único.", "Group items rented together and set one price.")} onClose={() => setKitsOpen(false)}>
          <KitManager items={items} kits={kits} language={language} t={t} onCreate={createKit} onDelete={deleteKit} />
        </Modal>
      )}

      {importReport && (
        <Modal title={importReport.title} subtitle={importReport.detail} onClose={() => setImportReport(null)}>
          <div className="import-report">
            {importReport.errors.length > 0 ? <ul>{importReport.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul> : <div className="import-success">✓</div>}
            <div className="modal-actions"><button className="button-primary" onClick={() => setImportReport(null)}>{t("Fechar", "Close")}</button></div>
          </div>
        </Modal>
      )}

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{detail}</p></div>{action}</div>;
}

function Overview({ language, t, items, reservations, userName, setView, openAdd, openReserve }: { language: Language; t: Translator; items: Item[]; reservations: Reservation[]; userName: string; setView: (view: View) => void; openAdd: () => void; openReserve: (item: Item) => void }) {
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  const available = items.reduce((sum, item) => sum + item.available, 0);
  const utilization = total ? Math.round(((total - available) / total) * 100) : 0;
  const estimatedRevenue = items.reduce((sum, item) => sum + (item.quantity - item.available) * (item.price || 0), 0);
  return (
    <>
      <PageHeading eyebrow={t("O SEU ESPAÇO DE TRABALHO", "YOUR WORKSPACE")} title={t(`Olá, ${userName}.`, `Hello, ${userName}.`)} detail={t("Veja a operação, as reservas e o desempenho do seu inventário.", "See your operations, reservations, and inventory performance.")} action={<button className="button-primary" onClick={openAdd}><span>＋</span>{t("Adicionar item", "Add item")}</button>} />
      <section className="stat-grid">
        <article><div className="stat-icon terracotta">▦</div><div><span>{t("Total de peças", "Total pieces")}</span><strong>{total}</strong><small><b>+12</b> {t("este mês", "this month")}</small></div></article>
        <article><div className="stat-icon olive">✓</div><div><span>{t("Disponíveis agora", "Available now")}</span><strong>{available}</strong><small>{Math.round((available / Math.max(total, 1)) * 100)}% {t("da colecção", "of collection")}</small></div></article>
        <article><div className="stat-icon gold">□</div><div><span>{t("Utilização", "Utilization")}</span><strong>{utilization}%</strong><small>{t("Em reservas activas", "In active reservations")}</small></div></article>
        <article><div className="stat-icon lilac">◎</div><div><span>{t("Receita estimada", "Estimated revenue")}</span><strong>{formatMoney(estimatedRevenue, "MZN", language)}</strong><small><b>↑ 18%</b> {t("este mês", "this month")}</small></div></article>
      </section>
      <section className="overview-grid">
        <article className="card schedule-card">
          <div className="card-heading"><div><span className="eyebrow">{t("ESTA SEMANA", "THIS WEEK")}</span><h2>{t("Próximos movimentos", "Upcoming movements")}</h2></div><button onClick={() => setView("calendar")}>{t("Ver calendário", "View calendar")} <span>→</span></button></div>
          <div className="schedule-list">
            {reservations.slice(0, 3).map((reservation, index) => (
              <button key={reservation.id} className="schedule-row" onClick={() => setView("calendar")}>
                <span className="date-block"><b>{index === 0 ? t("TER", "TUE") : index === 1 ? t("QUI", "THU") : t("SÁB", "SAT")}</b><strong>{new Date(`${reservation.date}T00:00:00`).getDate()}</strong></span>
                <span className="schedule-line" style={{ background: reservation.color }} />
                <span className="schedule-copy"><strong>{reservation.eventName || reservation.item}</strong><small>{reservation.item} · {reservation.client}</small></span>
                <span className={cls("status-pill", index === 0 ? "pickup" : index === 1 ? "delivery" : "return")}>{index === 0 ? t("Recolha", "Pickup") : index === 1 ? t("Entrega", "Delivery") : t("Devolução", "Return")}</span>
                <span className="row-arrow">›</span>
              </button>
            ))}
          </div>
        </article>
        <article className="card pulse-card">
          <div className="card-heading"><div><span className="eyebrow">{t("SAÚDE DO INVENTÁRIO", "INVENTORY HEALTH")}</span><h2>{t("Estado da colecção", "Collection health")}</h2></div><button aria-label={t("Mais opções", "More options")}>•••</button></div>
          <div className="donut-wrap"><div className="donut"><span><strong>{utilization}%</strong><small>{t("em uso", "in use")}</small></span></div><div className="legend"><p><i className="dot available" />{t("Disponível", "Available")} <b>{available}</b></p><p><i className="dot reserved" />{t("Reservado", "Reserved")} <b>{items.filter((item) => item.status === "Reserved").reduce((sum, item) => sum + item.quantity - item.available, 0)}</b></p><p><i className="dot rented" />{t("Alugado", "Rented out")} <b>{items.filter((item) => item.status === "Rented").reduce((sum, item) => sum + item.quantity - item.available, 0)}</b></p><p><i className="dot maintenance" />{t("A inspeccionar", "Inspection due")} <b>{items.filter((item) => item.condition?.toLowerCase().includes("inspec")).length}</b></p></div></div>
          <div className="capacity"><span><b>{t("Capacidade do armazém", "Storage capacity")}</b><small>{total} / 800 {t("lugares", "slots")}</small></span><div><i style={{ width: `${Math.min(100, (total / 800) * 100)}%` }} /></div></div>
        </article>
      </section>
      <section className="card recent-card">
        <div className="card-heading"><div><span className="eyebrow">{t("A SUA COLECÇÃO", "YOUR COLLECTION")}</span><h2>{t("Actualizados recentemente", "Recently updated")}</h2></div><button onClick={() => setView("storage")}>{t("Abrir inventário", "Open inventory")} <span>→</span></button></div>
        <div className="mini-item-grid">
          {items.slice(0, 4).map((item) => <ItemCard key={item.id} language={language} t={t} item={item} compact onReserve={() => openReserve(item)} />)}
        </div>
      </section>
      <Analytics language={language} t={t} items={items} reservations={reservations} />
    </>
  );
}

function Storage({ items, allItems, language, t, categories, query, setQuery, filter, setFilter, categoryFilter, setCategoryFilter, sort, setSort, openAdd, openCategories, openKits, manageItem, openReserve, removeItem, exportInventory, importInventory, bulkStatus, bulkRemove }: { items: Item[]; allItems: Item[]; language: Language; t: Translator; categories: string[]; query: string; setQuery: (value: string) => void; filter: string; setFilter: (value: string) => void; categoryFilter: string; setCategoryFilter: (value: string) => void; sort: string; setSort: (value: string) => void; openAdd: () => void; openCategories: () => void; openKits: () => void; manageItem: (item: Item) => void; openReserve: (item: Item) => void; removeItem: (item: Item) => void; exportInventory: () => void; importInventory: () => void; bulkStatus: (ids: number[], status: ItemStatus) => void; bulkRemove: (ids: number[]) => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const toggle = (id: number) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  return (
    <>
      <PageHeading eyebrow={t("ARMAZÉM", "STORAGE")} title={t("Inventário", "Inventory")} detail={t("Fotografias, quantidades, localização, preço e disponibilidade num só lugar.", "Photos, quantities, location, price, and availability in one place.")} action={<button className="button-primary" onClick={openAdd}><span>＋</span>{t("Adicionar item", "Add item")}</button>} />
      <div className="inventory-actions">
        <button className="button-secondary" onClick={openCategories}>＋ {t("Gerir categorias", "Manage categories")}</button>
        <button className="button-secondary" onClick={openKits}>◇ {t("Kits e conjuntos", "Kits & sets")}</button>
        <button className="button-secondary" onClick={importInventory}>↑ {t("Importar Excel / CSV", "Import Excel / CSV")}</button>
        <button className="button-secondary" onClick={exportInventory}>↓ {t("Exportar CSV", "Export CSV")}</button>
      </div>
      <div className="toolbar">
        <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Pesquisar nome, categoria ou local…", "Search name, category, or location…")} /></label>
        <select className="toolbar-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label={t("Filtrar por categoria", "Filter by category")}><option value="All">{t("Todas as categorias", "All categories")}</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
        <div className="filter-pills">
          {[["All items", t("Todos", "All")], ["Available", t("Disponíveis", "Available")], ["Reserved", t("Reservados", "Reserved")], ["Rented", t("Alugados", "Rented")]].map(([value, label]) => <button key={value} className={cls(filter === value && "active")} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <select className="toolbar-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label={t("Ordenar inventário", "Sort inventory")}><option value="name">{t("Nome A–Z", "Name A–Z")}</option><option value="available">{t("Mais disponíveis", "Most available")}</option><option value="price-low">{t("Menor preço", "Lowest price")}</option><option value="price-high">{t("Maior preço", "Highest price")}</option></select>
      </div>
      {selected.length > 0 && <div className="bulk-bar"><strong>{selected.length} {t("seleccionados", "selected")}</strong><button onClick={() => { bulkStatus(selected, "Rented"); setSelected([]); }}>{t("Marcar como alugado", "Mark as rented")}</button><button onClick={() => { bulkStatus(selected, "Available"); setSelected([]); }}>{t("Marcar disponível", "Mark available")}</button><button className="danger" onClick={() => { bulkRemove(selected); setSelected([]); }}>{t("Eliminar", "Delete")}</button><button onClick={() => setSelected([])}>×</button></div>}
      <div className="collection-summary"><span><b>{items.length}</b> {t("tipos de item", "item types")}</span><span><b>{allItems.reduce((sum, item) => sum + item.quantity, 0)}</b> {t("peças individuais", "individual pieces")}</span><span><i />{t("Sincronizado agora", "Synced just now")}</span></div>
      {items.length ? <div className="storage-grid">{items.map((item) => <ItemCard key={item.id} language={language} t={t} item={item} selected={selected.includes(item.id)} onSelect={() => toggle(item.id)} onReserve={() => openReserve(item)} onManage={() => manageItem(item)} onRemove={() => removeItem(item)} />)}</div> : <div className="empty-state"><span>⌕</span><h3>{t("Nenhum item encontrado", "No items found")}</h3><p>{t("Ajuste os filtros ou adicione um novo item.", "Adjust the filters or add something new.")}</p></div>}
    </>
  );
}

function ItemCard({ item, language, t, compact, selected, onSelect, onReserve, onManage, onRemove }: { item: Item; language: Language; t: Translator; compact?: boolean; selected?: boolean; onSelect?: () => void; onReserve: () => void; onManage?: () => void; onRemove?: () => void }) {
  const statusLabel = item.status === "Available" ? t("Disponível", "Available") : item.status === "Reserved" ? t("Reservado", "Reserved") : t("Alugado", "Rented");
  return (
    <article className={cls("item-card", compact && "compact", selected && "selected")}>
      <div className={cls("item-visual", item.tone)}>{item.photoUrl ? <img src={item.photoUrl} alt={item.name} /> : <span>{item.symbol}</span>}{onSelect && <label className="item-select"><input type="checkbox" checked={selected} onChange={onSelect} aria-label={t(`Seleccionar ${item.name}`, `Select ${item.name}`)} /><i>✓</i></label>}<button aria-label={t(`Favoritar ${item.name}`, `Favorite ${item.name}`)}>♡</button></div>
      <div className="item-info">
        <span className="item-category">{item.category}</span>
        <h3>{item.name}</h3>
        <strong className="item-price">{formatMoney(item.price || 0, item.currency || "MZN", language)} <small>/ {t("dia", "day")}</small></strong>
        <div className="item-meta"><span><b>{item.available}</b> / {item.quantity} {t("disponíveis", "available")}</span><span className={cls("status-dot", item.status.toLowerCase())}>{statusLabel}</span></div>
        {!compact && <><div className="item-extra"><span>⌖ {item.storageLocation || t("Local por definir", "Location not set")}</span><span>◇ {item.condition || t("Bom", "Good")}</span>{item.minStock > 0 && item.available <= item.minStock && <span className="low-stock">! {t("Stock baixo", "Low stock")}</span>}</div><div className="item-card-actions"><button onClick={onReserve}>{t("Reservar", "Reserve")}</button>{onManage && <button className="manage-item" onClick={onManage}>{t("Gerir", "Manage")}</button>}{onRemove && <button onClick={onRemove} aria-label={t(`Remover ${item.name}`, `Remove ${item.name}`)}>×</button>}</div></>}
      </div>
    </article>
  );
}

function Calendar({ language, t, reservations, openAdd }: { language: Language; t: Translator; reservations: Reservation[]; openAdd: () => void }) {
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(new Date(2026, 6, 27));
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(reservations[0] || null);
  const days = calendarView === "month" ? getMonthCells(cursor) : getWeekDays(cursor);
  const title = calendarView === "month"
    ? cursor.toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", { month: "long", year: "numeric" })
    : `${days[0].toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", { day: "numeric", month: "short" })} — ${days[6].toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", { day: "numeric", month: "short", year: "numeric" })}`;
  const move = (direction: number) => {
    const next = new Date(cursor);
    if (calendarView === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * 7);
    setCursor(next);
  };
  const reservationsFor = (date: Date) => reservations.filter((reservation) => dateKey(date) >= reservation.date && dateKey(date) <= reservation.endDate);
  return (
    <>
      <PageHeading eyebrow={t("AGENDA PARTILHADA", "SHARED SCHEDULE")} title={t("Calendário", "Calendar")} detail={t("Veja eventos e reservas por semana ou mês — sem procurar item por item.", "See events and reservations by week or month—without browsing item by item.")} action={<button className="button-primary" onClick={openAdd}><span>＋</span>{t("Nova reserva", "New reservation")}</button>} />
      <section className="calendar-layout">
        <article className="card calendar-card">
          <div className="calendar-toolbar"><button onClick={() => move(-1)}>‹</button><h2>{title}</h2><button onClick={() => move(1)}>›</button><button className="today-button" onClick={() => setCursor(new Date(2026, 6, 27))}>{t("Hoje", "Today")}</button><div className="calendar-view-toggle"><button className={cls(calendarView === "week" && "active")} onClick={() => setCalendarView("week")}>{t("Semana", "Week")}</button><button className={cls(calendarView === "month" && "active")} onClick={() => setCalendarView("month")}>{t("Mês", "Month")}</button></div></div>
          {calendarView === "month" ? <div className="calendar-grid">
            {(language === "pt" ? ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"] : ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]).map((day) => <div className="weekday" key={day}>{day}</div>)}
            {days.map((day) => {
              const dayReservations = reservationsFor(day);
              const muted = day.getMonth() !== cursor.getMonth();
              return <div className={cls("calendar-day", muted && "muted", dateKey(day) === "2026-07-27" && "today")} key={dateKey(day)}><span>{day.getDate()}</span>{dayReservations.slice(0, 3).map((reservation) => <button key={reservation.id} onClick={() => setSelectedReservation(reservation)} style={{ "--event": reservation.color } as React.CSSProperties}><b>{reservation.eventName || reservation.client}</b><small>{reservation.item}</small></button>)}{dayReservations.length > 3 && <em>+{dayReservations.length - 3}</em>}</div>;
            })}
          </div> : <div className="week-calendar">
            {days.map((day) => <div className={cls("week-day", dateKey(day) === "2026-07-27" && "today")} key={dateKey(day)}><header><span>{day.toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", { weekday: "short" })}</span><strong>{day.getDate()}</strong></header><div className="week-day-body">{reservationsFor(day).map((reservation) => <button key={reservation.id} style={{ "--event": reservation.color } as React.CSSProperties} onClick={() => setSelectedReservation(reservation)}><small>09:30</small><strong>{reservation.eventName || reservation.client}</strong><span>{reservation.item}</span></button>)}{!reservationsFor(day).length && <span className="week-empty">—</span>}</div></div>)}
          </div>}
        </article>
        <ReservationInspector language={language} t={t} reservation={selectedReservation} />
      </section>
      <section className="card reservation-list">
        <div className="card-heading"><div><span className="eyebrow">{t("RESERVAS", "RESERVATIONS")}</span><h2>{t("Próximos eventos", "Upcoming events")}</h2></div><button onClick={() => downloadCsv("trove-reservas.csv", [["event", "client", "item", "start", "end", "contact", "notes"], ...reservations.map((r) => [r.eventName, r.client, r.item, r.date, r.endDate, r.contact, r.notes])])}>{t("Exportar agenda", "Export schedule")} ↓</button></div>
        {reservations.map((reservation) => <button className="reservation-row" key={reservation.id} onClick={() => setSelectedReservation(reservation)}><i style={{ background: reservation.color }} /><span><strong>{reservation.eventName || reservation.item}</strong><small>{reservation.item} · {reservation.client}</small></span><span><strong>{new Date(`${reservation.date}T00:00:00`).toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", { day: "numeric", month: "short" })} — {new Date(`${reservation.endDate}T00:00:00`).toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", { day: "numeric", month: "short" })}</strong><small>{reservation.contact || t("Sem contacto", "No contact")}</small></span><span className="status-pill pickup">{t("Confirmada", "Confirmed")}</span><span>›</span></button>)}
      </section>
    </>
  );
}

function Network({ plan, t, query, setQuery, items, requested, onRequest, openPlans }: { plan: string; t: Translator; query: string; setQuery: (value: string) => void; items: typeof networkItems; requested: string[]; onRequest: (name: string) => void; openPlans: () => void }) {
  if (plan !== "Network") return <section className="locked-network"><div className="network-orbit">◎</div><span className="eyebrow">TROVE NETWORK</span><h1>{t("Mais inventário, sem mais armazém.", "More inventory, without more storage.")}</h1><p>{t("Pesquise decoradores verificados, veja disponibilidade e reserve o que precisa.", "Search trusted decorators, see availability, and reserve what you need.")}</p><button className="button-primary" onClick={openPlans}>{t("Explorar plano Network", "Explore Network plan")}</button></section>;
  return (
    <>
      <PageHeading eyebrow="TROVE NETWORK" title={t("Encontre perto de si.", "Find it nearby.")} detail={t("Alugue a decoradores da região e transforme stock parado em receita.", "Borrow locally and turn idle stock into income.")} action={<button className="button-secondary">{t("Meus pedidos", "My requests")} <span>3</span></button>} />
      <section className="network-hero">
        <div><span className="eyebrow">{t("PESQUISE 24.000+ PEÇAS LOCAIS", "SEARCH 24,000+ LOCAL PIECES")}</span><h2>{t("O que precisa o seu próximo evento?", "What does your next event need?")}</h2><label className="network-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Ex.: cadeiras ghost ou guardanapos de linho…", "Try ghost chairs or linen napkins…")} /><button>{t("Pesquisar", "Search")}</button></label><div className="popular-searches"><small>{t("Popular:", "Popular:")}</small>{[t("Plintos", "Plinths"), t("Cadeiras", "Chairs"), t("Jarras", "Bud vases"), t("Castiçais", "Candle holders")].map((term) => <button key={term} onClick={() => setQuery(term)}>{term}</button>)}</div></div>
        <div className="network-map"><span className="map-road one" /><span className="map-road two" /><span className="map-road three" /><i className="map-pin p1">12</i><i className="map-pin p2">8</i><i className="map-pin p3">4</i><i className="map-you">YOU</i></div>
      </section>
      <div className="network-heading"><div><h2>{t("Disponível perto de Maputo", "Available near Maputo")}</h2><p>{t("Negócios verificados · Próximos 30 dias", "Verified businesses · Next 30 days")}</p></div><button className="button-secondary">{t("Até 25 km", "Within 25 km")}⌄</button></div>
      <div className="network-grid">
        {items.map((item) => (
          <article className="network-card" key={item.name}>
            <div className={cls("network-visual", item.tone)}><span>{item.symbol}</span><em>{item.available} {t("disponíveis", "available")}</em></div>
            <div className="network-info"><div className="network-owner"><i>{item.owner.split(" ").map((word) => word[0]).join("").slice(0, 2)}</i><span><strong>{item.owner} <b>✓</b></strong><small>★ {item.rating} · {item.distance}</small></span></div><h3>{item.name}</h3><div className="network-price"><strong>{item.price}</strong><button disabled={requested.includes(item.name)} onClick={() => onRequest(item.name)}>{requested.includes(item.name) ? t("Pedido enviado ✓", "Requested ✓") : t("Ver datas", "Check dates")}</button></div></div>
          </article>
        ))}
      </div>
    </>
  );
}

function ProfileEditor({ t, profile, setProfile, save, saving }: { t: Translator; profile: Profile; setProfile: (profile: Profile) => void; save: () => void; saving: boolean }) {
  const colors = ["#b75d3f", "#78836a", "#ba914d", "#3f5f68", "#755f72", "#303634"];
  const update = (key: keyof Profile, value: string) => setProfile({ ...profile, [key]: value });
  return (
    <>
      <PageHeading eyebrow={t("O SEU NEGÓCIO", "YOUR BUSINESS")} title={t("Perfil público", "Public profile")} detail={t("Crie uma presença profissional que representa a sua marca.", "Create a polished presence that represents your brand.")} action={<button className="button-primary" onClick={save}>{saving ? t("A guardar…", "Saving…") : t("Guardar alterações", "Save changes")}</button>} />
      <section className="profile-layout">
        <div className="profile-editor card">
          <div className="section-title"><span>01</span><div><h2>{t("Identidade do negócio", "Business identity")}</h2><p>{t("A informação que clientes e decoradores verão.", "The information clients and decorators will see.")}</p></div></div>
          <div className="avatar-edit"><div className="profile-avatar" style={{ background: profile.color }}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : profile.businessName.split(" ").map((word) => word[0]).join("").slice(0, 2)}</div><span><strong>{t("Fotografia do perfil", "Profile picture")}</strong><small>JPG ou PNG · Máx. 5 MB</small><label className="button-secondary">{t("Escolher imagem", "Choose image")}<input type="file" accept="image/png,image/jpeg" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const body = new FormData();
            body.append("file", file);
            try {
              const response = await fetch("/api/profile-image", { method: "POST", body });
              if (response.ok) {
                const data = await response.json() as { url: string };
                update("avatarUrl", data.url);
              }
            } catch { /* Preview stays usable without upload binding. */ }
          }} /></label></span></div>
          <div className="form-grid"><label>{t("Nome do negócio", "Business name")}<input value={profile.businessName} onChange={(event) => update("businessName", event.target.value)} /></label><label>{t("Endereço do perfil", "Profile address")}<span className="input-prefix">trove.co/<input value={profile.handle} onChange={(event) => update("handle", event.target.value)} /></span></label></div>
          <label>{t("Biografia", "Bio")}<textarea rows={4} maxLength={220} value={profile.bio} onChange={(event) => update("bio", event.target.value)} /><small className="char-count">{profile.bio.length}/220</small></label>
          <div className="divider" />
          <div className="section-title"><span>02</span><div><h2>{t("Cor da marca", "Brand colour")}</h2><p>{t("Escolha uma cor inspirada em marcas de decoração.", "Choose a tone inspired by décor brands.")}</p></div></div>
          <div className="color-picker">{colors.map((color) => <button aria-label={`Choose ${color}`} key={color} style={{ background: color }} className={cls(profile.color === color && "active")} onClick={() => update("color", color)}><span>✓</span></button>)}</div>
          <div className="divider" />
          <div className="section-title"><span>03</span><div><h2>{t("Contactos", "Contact details")}</h2><p>{t("Ajude visitantes a entrar em contacto.", "Help visitors get in touch.")}</p></div></div>
          <div className="form-grid"><label>{t("Localização", "Location")}<input value={profile.location} onChange={(event) => update("location", event.target.value)} /></label><label>{t("Telefone", "Phone")}<input value={profile.phone} onChange={(event) => update("phone", event.target.value)} /></label></div>
          <label>{t("Email", "Email address")}<input value={profile.email} onChange={(event) => update("email", event.target.value)} /></label>
        </div>
        <aside className="profile-preview-wrap"><div className="preview-label"><span className="eyebrow">{t("PRÉ-VISUALIZAÇÃO", "LIVE PREVIEW")}</span><button>↗ {t("Abrir página pública", "Open public page")}</button></div><div className="public-profile-card"><div className="profile-cover" style={{ background: profile.color }}><span /><span /></div><div className="public-content"><div className="public-avatar" style={{ background: profile.color }}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : profile.businessName.split(" ").map((word) => word[0]).join("").slice(0, 2)}</div><span className="verified">{t("DECORADOR VERIFICADO", "VERIFIED DECORATOR")} · <b>✓</b></span><h2>{profile.businessName}</h2><p>{profile.bio}</p><small>⌖ {profile.location}</small><div className="public-actions"><button style={{ background: profile.color }}>{t("Enviar pedido", "Send an enquiry")}</button><button>♡</button></div><div className="public-stats"><span><strong>184</strong><small>{t("peças", "pieces")}</small></span><span><strong>4.9</strong><small>{t("avaliação", "rating")}</small></span><span><strong>6 {t("anos", "yrs")}</strong><small>{t("em actividade", "in business")}</small></span></div></div></div><p className="preview-footnote">{t("As alterações aparecem aqui imediatamente.", "Changes appear here instantly.")}</p></aside>
      </section>
    </>
  );
}

function Plans({ t, plan, choose }: { t: Translator; plan: "Basic" | "Network"; choose: (plan: "Basic" | "Network") => void }) {
  return (
    <>
      <PageHeading eyebrow={t("SUBSCRIÇÃO", "SUBSCRIPTION")} title={t("Um plano que cresce consigo.", "A plan that grows with you.")} detail={t("Comece pelo inventário e desbloqueie a rede local quando precisar.", "Start with inventory and unlock the local network when you need it.")} />
      <section className="billing-toggle"><button className="active">{t("Mensal", "Monthly")}</button><button>{t("Anual", "Yearly")} <span>{t("Poupe 20%", "Save 20%")}</span></button></section>
      <section className="plans-grid">
        <article className={cls("pricing-card", plan === "Basic" && "current")}><span className="plan-label">STORAGE</span><h2>Basic</h2><p>{t("Tudo para uma pequena equipa se manter organizada.", "Everything a small team needs to stay organised.")}</p><div className="price"><strong>1 200</strong><span>MZN / {t("mês", "month")}<br /><small>{t("por negócio", "per business")}</small></span></div><button className="button-secondary" onClick={() => choose("Basic")}>{plan === "Basic" ? t("Plano actual", "Current plan") : t("Escolher Basic", "Choose Basic")}</button><ul><li>✓ {t("Inventário ilimitado", "Unlimited inventory")}</li><li>✓ {t("Calendário partilhado", "Shared calendar")}</li><li>✓ {t("Até 3 colaboradores", "Up to 3 team members")}</li><li>✓ {t("Perfil público", "Public profile")}</li><li>✓ {t("Exportação CSV", "CSV exports")}</li></ul></article>
        <article className={cls("pricing-card featured", plan === "Network" && "current")}><span className="recommended">{t("MAIS POPULAR", "MOST POPULAR")}</span><span className="plan-label">STORAGE + NETWORK</span><h2>Network</h2><p>{t("Gira a colecção e expanda-a através de parceiros locais.", "Manage and expand through local partners.")}</p><div className="price"><strong>3 100</strong><span>MZN / {t("mês", "month")}<br /><small>{t("por negócio", "per business")}</small></span></div><button className="button-primary" onClick={() => choose("Network")}>{plan === "Network" ? t("Plano actual", "Current plan") : t("Mudar para Network", "Upgrade to Network")}</button><ul><li>✓ {t("Tudo no Basic", "Everything in Basic")}</li><li>✓ {t("Pesquisar stock local", "Search local stock")}</li><li>✓ {t("Pedir e aceitar alugueres", "Request and accept rentals")}</li><li>✓ {t("Preços e condições próprias", "Own pricing and terms")}</li><li>✓ {t("Colaboradores ilimitados", "Unlimited team members")}</li><li>✓ {t("Análise de receita", "Revenue analytics")}</li></ul></article>
      </section>
      <section className="plan-note"><span>♡</span><div><strong>{t("Pensado para a realidade dos decoradores.", "Built for how decorators actually work.")}</strong><p>{t("Sem contratos. Mude ou cancele quando quiser.", "No contracts. Switch or cancel anytime.")}</p></div><button>{t("Perguntas frequentes", "Common questions")} →</button></section>
    </>
  );
}

function Analytics({ language, t, items, reservations }: { language: Language; t: Translator; items: Item[]; reservations: Reservation[] }) {
  const categoryData = Array.from(new Set(items.map((item) => item.category))).map((category) => {
    const categoryItems = items.filter((item) => item.category === category);
    const total = categoryItems.reduce((sum, item) => sum + item.quantity, 0);
    const inUse = categoryItems.reduce((sum, item) => sum + item.quantity - item.available, 0);
    return { category, rate: total ? Math.round((inUse / total) * 100) : 0 };
  }).sort((a, b) => b.rate - a.rate).slice(0, 5);
  const weekly = [42, 58, 36, 74, 67, 88, 62];
  const revenue = items.reduce((sum, item) => sum + (item.quantity - item.available) * (item.price || 0), 0);
  return <section className="analytics-grid">
    <article className="card analytics-card">
      <div className="card-heading"><div><span className="eyebrow">{t("ANÁLISE", "ANALYTICS")}</span><h2>{t("Ocupação por categoria", "Utilization by category")}</h2></div><span className="analytics-period">{t("Últimos 30 dias", "Last 30 days")}</span></div>
      <div className="category-bars">{categoryData.map((entry) => <div key={entry.category}><span><b>{entry.category}</b><small>{entry.rate}%</small></span><i><em style={{ width: `${entry.rate}%` }} /></i></div>)}</div>
    </article>
    <article className="card analytics-card">
      <div className="card-heading"><div><span className="eyebrow">{t("DESEMPENHO", "PERFORMANCE")}</span><h2>{t("Reservas e receita", "Bookings & revenue")}</h2></div></div>
      <div className="analytics-summary"><span><strong>{reservations.length}</strong><small>{t("reservas activas", "active bookings")}</small></span><span><strong>{formatMoney(revenue, "MZN", language)}</strong><small>{t("valor em circulação", "value in circulation")}</small></span></div>
      <div className="weekly-chart">{weekly.map((height, index) => <span key={index}><i style={{ height: `${height}%` }} /><small>{(language === "pt" ? ["S", "T", "Q", "Q", "S", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"])[index]}</small></span>)}</div>
    </article>
  </section>;
}

function ReservationInspector({ language, t, reservation }: { language: Language; t: Translator; reservation: Reservation | null }) {
  if (!reservation) return <aside className="card agenda-card"><span className="eyebrow">{t("DETALHES", "DETAILS")}</span><div className="agenda-empty"><span>☼</span><strong>{t("Nenhuma reserva seleccionada", "No reservation selected")}</strong><p>{t("Seleccione um evento no calendário.", "Select an event on the calendar.")}</p></div></aside>;
  return <aside className="card agenda-card reservation-inspector">
    <span className="eyebrow">{t("DETALHES DA RESERVA", "RESERVATION DETAILS")}</span>
    <h2>{reservation.eventName || reservation.client}</h2>
    <span className="status-pill delivery">{t("Confirmada", "Confirmed")}</span>
    <dl>
      <div><dt>{t("Cliente", "Client")}</dt><dd>{reservation.client}</dd></div>
      <div><dt>{t("Item", "Item")}</dt><dd>{reservation.item}</dd></div>
      <div><dt>{t("Datas", "Dates")}</dt><dd>{new Date(`${reservation.date}T00:00:00`).toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", { day: "numeric", month: "short" })} — {new Date(`${reservation.endDate}T00:00:00`).toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", { day: "numeric", month: "short" })}</dd></div>
      <div><dt>{t("Contacto", "Contact")}</dt><dd>{reservation.contact || "—"}</dd></div>
      <div><dt>{t("Notas", "Notes")}</dt><dd>{reservation.notes || t("Sem notas adicionais.", "No additional notes.")}</dd></div>
    </dl>
    <div className="inspector-actions"><button className="button-secondary">{t("Editar", "Edit")}</button><button className="button-primary">{t("Contactar", "Contact")}</button></div>
  </aside>;
}

function ItemManager({ item, categories, photos, movements, maintenance, language, t, onUpdate, onAddPhotos, onRemovePhoto, onAdjustStock, onAddMaintenance, onCompleteMaintenance }: {
  item: Item;
  categories: string[];
  photos: ItemPhoto[];
  movements: StockMovement[];
  maintenance: MaintenanceRecord[];
  language: Language;
  t: Translator;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (photo: ItemPhoto) => void;
  onAdjustStock: (event: FormEvent<HTMLFormElement>) => void;
  onAddMaintenance: (event: FormEvent<HTMLFormElement>) => void;
  onCompleteMaintenance: (record: MaintenanceRecord) => void;
}) {
  const [tab, setTab] = useState<"details" | "gallery" | "stock" | "maintenance">("details");
  return <div className="item-manager">
    <nav className="manager-tabs">
      <button className={cls(tab === "details" && "active")} onClick={() => setTab("details")}>{t("Ficha", "Details")}</button>
      <button className={cls(tab === "gallery" && "active")} onClick={() => setTab("gallery")}>{t("Fotografias", "Photos")} <span>{photos.length}</span></button>
      <button className={cls(tab === "stock" && "active")} onClick={() => setTab("stock")}>{t("Stock e histórico", "Stock & history")}</button>
      <button className={cls(tab === "maintenance" && "active")} onClick={() => setTab("maintenance")}>{t("Manutenção", "Maintenance")} <span>{maintenance.filter((record) => record.status !== "Completed").length}</span></button>
    </nav>
    {tab === "details" && <form key={`details-${item.id}-${item.quantity}`} className="modal-form manager-panel" onSubmit={onUpdate}>
      <div className="form-grid"><label>{t("Nome", "Name")}<input name="name" defaultValue={item.name} required /></label><label>SKU<input name="sku" defaultValue={item.sku} /></label></div>
      <label>{t("Descrição", "Description")}<textarea name="description" rows={3} defaultValue={item.description} /></label>
      <div className="form-grid"><label>{t("Categoria", "Category")}<select name="category" defaultValue={item.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>{t("Estado", "Status")}<select name="status" defaultValue={item.status}><option value="Available">{t("Disponível", "Available")}</option><option value="Reserved">{t("Reservado", "Reserved")}</option><option value="Rented">{t("Alugado", "Rented")}</option></select></label></div>
      <div className="form-grid"><label>{t("Quantidade total", "Total quantity")}<input name="quantity" type="number" min="1" defaultValue={item.quantity} required /></label><label>{t("Disponível", "Available")}<input name="available" type="number" min="0" defaultValue={item.available} required /></label></div>
      <div className="form-grid"><label>{t("Preço / dia", "Price / day")}<input name="price" type="number" min="0" defaultValue={item.price} required /></label><label>{t("Moeda", "Currency")}<select name="currency" defaultValue={item.currency || "MZN"}><option value="MZN">MZN · Metical</option><option value="ZAR">ZAR · Rand</option><option value="USD">USD · Dollar</option><option value="EUR">EUR · Euro</option></select></label></div>
      <div className="form-grid"><label>{t("Valor de reposição (MZN)", "Replacement value (MZN)")}<input name="replacementValue" type="number" min="0" defaultValue={item.replacementValue} /></label><label>{t("Stock mínimo", "Minimum stock")}<input name="minStock" type="number" min="0" defaultValue={item.minStock} /></label></div>
      <label>{t("Condição", "Condition")}<select name="condition" defaultValue={item.condition}><option>{t("Excelente", "Excellent")}</option><option>{t("Bom", "Good")}</option><option>{t("Requer inspecção", "Needs inspection")}</option><option>{t("Em manutenção", "In maintenance")}</option><option>{t("Danificado", "Damaged")}</option></select></label>
      <label>{t("Localização no armazém", "Storage location")}<input name="storageLocation" defaultValue={item.storageLocation} /></label>
      <div className="modal-actions"><button className="button-primary">{t("Guardar ficha", "Save record")}</button></div>
    </form>}
    {tab === "gallery" && <section className="manager-panel">
      <label className="photo-upload-field"><span>▧</span><span><strong>{t("Adicionar fotografias", "Add photos")}</strong><small>{8 - photos.length} {t("lugares disponíveis", "slots available")}</small></span><input type="file" multiple accept="image/png,image/jpeg" onChange={(event) => { onAddPhotos(Array.from(event.target.files || [])); event.target.value = ""; }} /></label>
      {photos.length ? <div className="photo-gallery">{photos.map((photo, index) => <figure key={photo.id}><img src={photo.url} alt={`${item.name} ${index + 1}`} /><figcaption>{index === 0 ? t("Capa", "Cover") : `${index + 1}`}<button onClick={() => onRemovePhoto(photo)}>{t("Remover", "Remove")}</button></figcaption></figure>)}</div> : <div className="manager-empty">▧<strong>{t("Ainda não há fotografias", "No photos yet")}</strong></div>}
    </section>}
    {tab === "stock" && <section className="manager-panel manager-columns">
      <form className="operation-form" onSubmit={onAdjustStock}><h3>{t("Registar movimento", "Record movement")}</h3><div className="stock-balance"><span><strong>{item.quantity}</strong><small>{t("total", "total")}</small></span><span><strong>{item.available}</strong><small>{t("disponível", "available")}</small></span></div><div className="form-grid"><label>{t("Tipo", "Type")}<select name="type"><option value="purchase">{t("Compra / entrada", "Purchase / incoming")}</option><option value="adjustment">{t("Acerto", "Adjustment")}</option><option value="damage">{t("Dano / perda", "Damage / loss")}</option><option value="retirement">{t("Abate", "Retirement")}</option></select></label><label>{t("Variação", "Change")}<input name="delta" type="number" placeholder="+5 ou -2" required /></label></div><label>{t("Nota", "Note")}<input name="note" placeholder={t("Factura, motivo ou responsável…", "Invoice, reason, or owner…")} /></label><button className="button-primary">{t("Registar movimento", "Record movement")}</button></form>
      <div className="history-list"><h3>{t("Histórico", "History")}</h3>{movements.length ? movements.map((movement) => <article key={movement.id}><i className={movement.quantityDelta >= 0 ? "positive" : "negative"}>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</i><span><strong>{movement.type}</strong><small>{movement.note || t("Sem nota", "No note")} · {new Date(movement.createdAt).toLocaleDateString(language === "pt" ? "pt-MZ" : "en-MZ")}</small></span></article>) : <p>{t("Sem movimentos registados.", "No movements recorded.")}</p>}</div>
    </section>}
    {tab === "maintenance" && <section className="manager-panel manager-columns">
      <form className="operation-form" onSubmit={onAddMaintenance}><h3>{t("Nova intervenção", "New intervention")}</h3><div className="form-grid"><label>{t("Tipo", "Type")}<select name="type"><option value="inspection">{t("Inspecção", "Inspection")}</option><option value="cleaning">{t("Limpeza", "Cleaning")}</option><option value="repair">{t("Reparação", "Repair")}</option><option value="damage">{t("Dano", "Damage")}</option></select></label><label>{t("Data prevista", "Scheduled date")}<input name="scheduledDate" type="date" /></label></div><label>{t("Custo (MZN)", "Cost (MZN)")}<input name="cost" type="number" min="0" defaultValue="0" /></label><label>{t("Notas", "Notes")}<textarea name="notes" rows={3} required /></label><button className="button-primary">{t("Registar intervenção", "Add intervention")}</button></form>
      <div className="maintenance-list"><h3>{t("Intervenções", "Interventions")}</h3>{maintenance.length ? maintenance.map((record) => <article key={record.id}><span className={cls("maintenance-status", record.status === "Completed" && "completed")}>{record.status === "Completed" ? "✓" : "!"}</span><span><strong>{record.type}</strong><small>{record.notes}</small><em>{record.scheduledDate || t("Sem data", "No date")} · {formatMoney(record.cost, "MZN", language)}</em></span>{record.status !== "Completed" && <button onClick={() => onCompleteMaintenance(record)}>{t("Concluir", "Complete")}</button>}</article>) : <p>{t("Nenhuma intervenção registada.", "No maintenance records.")}</p>}</div>
    </section>}
  </div>;
}

function KitManager({ items, kits, language, t, onCreate, onDelete }: { items: Item[]; kits: Kit[]; language: Language; t: Translator; onCreate: (event: FormEvent<HTMLFormElement>) => void; onDelete: (kit: Kit) => void }) {
  return <div className="kit-manager">
    <form className="operation-form" onSubmit={onCreate}><h3>{t("Criar novo kit", "Create a new kit")}</h3><div className="form-grid"><label>{t("Nome", "Name")}<input name="name" placeholder={t("Mesa romântica para 10", "Romantic table for 10")} required /></label><label>{t("Preço do kit (MZN)", "Kit price (MZN)")}<input name="price" type="number" min="0" required /></label></div><label>{t("Descrição", "Description")}<textarea name="description" rows={2} /></label><div className="kit-item-picker">{items.map((item) => <label key={item.id}><input name={`kit-item-${item.id}`} type="checkbox" value={item.id} /><span><strong>{item.name}</strong><small>{item.available} {t("disponíveis", "available")}</small></span><input name={`kit-quantity-${item.id}`} type="number" min="1" max={item.quantity} defaultValue="1" aria-label={t(`Quantidade de ${item.name}`, `${item.name} quantity`)} /></label>)}</div><button className="button-primary">{t("Criar kit", "Create kit")}</button></form>
    <div className="kit-list"><h3>{t("Kits activos", "Active kits")}</h3>{kits.length ? kits.map((kit) => <article key={kit.id}><div><span>◇</span><div><strong>{kit.name}</strong><small>{kit.items.map((entry) => `${entry.quantity}× ${items.find((item) => item.id === entry.itemId)?.name || t("Artigo removido", "Removed item")}`).join(" · ")}</small></div></div><footer><b>{formatMoney(kit.price, kit.currency, language)}</b><button onClick={() => onDelete(kit)}>{t("Remover", "Remove")}</button></footer></article>) : <div className="manager-empty">◇<strong>{t("Ainda não existem kits", "No kits yet")}</strong></div>}</div>
  </div>;
}

function CategoryManager({ t, categories, addCategory, removeCategory }: { t: Translator; categories: string[]; addCategory: (name: string) => void; removeCategory: (name: string) => void }) {
  const [name, setName] = useState("");
  return <div className="category-manager"><form onSubmit={(event) => { event.preventDefault(); addCategory(name); setName(""); }}><input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("Nova categoria…", "New category…")} required /><button className="button-primary">{t("Adicionar", "Add")}</button></form><div>{categories.map((category) => <span key={category}><i>▦</i><b>{category}</b><button onClick={() => removeCategory(category)} aria-label={t(`Remover ${category}`, `Remove ${category}`)}>×</button></span>)}</div><p>{t("Ao remover uma categoria, os itens passam para “Sem categoria”.", "Removing a category moves its items to “Uncategorized”.")}</p></div>;
}

function TeamManager({ t, members, canInvite, onInvite }: { t: Translator; members: Member[]; canInvite: boolean; onInvite: (email: string, role: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("inventory");
  return <div className="team-manager"><div className="team-members">{members.map((member, index) => <span key={`${member.id}-${member.email}`}><i className={["clay", "olive", "gold"][index % 3]}>{initials(member.displayName || member.email)}</i><b>{member.displayName || member.email}<small>{roleLabel(member.role, t)}</small></b><em>{member.status === "Pending" ? t("Pendente", "Pending") : t("Activo", "Active")}</em></span>)}</div>{canInvite && <form onSubmit={(event) => { event.preventDefault(); onInvite(email, role); setEmail(""); }}><label>{t("Email do colaborador", "Collaborator email")}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@empresa.co.mz" required /></label><label>{t("Permissão", "Permission")}<select value={role} onChange={(event) => setRole(event.target.value)}><option value="inventory">{t("Gestão de inventário", "Inventory manager")}</option><option value="reservations">{t("Gestão de reservas", "Booking manager")}</option><option value="viewer">{t("Apenas consulta", "View only")}</option></select></label><button className="button-primary">{t("Registar convite", "Record invitation")}</button></form>}<p>{t("A conta convidada obtém acesso quando iniciar sessão com este endereço. O envio automático de email será ligado na Fase 4.", "The invited account gets access when it signs in with this address. Automatic invitation email will be connected in Phase 4.")}</p></div>;
}

function getMonthCells(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getWeekDays(cursor: Date) {
  const monday = new Date(cursor);
  monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCsvRow(row: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(current.trim()); current = ""; }
    else current += char;
  }
  values.push(current.trim());
  return values;
}

function downloadCsv(filename: string, rows: (string | number | undefined)[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Modal({ title, subtitle, onClose, children, wide }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={cls("modal", wide && "modal-wide")} role="dialog" aria-modal="true" aria-label={title}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">TROVE STORAGE</span><h2>{title}</h2><p>{subtitle}</p>{children}</section></div>;
}
