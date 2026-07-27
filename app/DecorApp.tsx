"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "home" | "storage" | "calendar" | "network" | "profile" | "plans";
type ItemStatus = "Available" | "Reserved" | "Rented";

type Item = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  available: number;
  status: ItemStatus;
  tone: string;
  symbol: string;
};

type Reservation = {
  id: number;
  item: string;
  client: string;
  date: string;
  endDate: string;
  color: string;
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

const seedItems: Item[] = [
  { id: 1, name: "Bentwood dining chair", category: "Furniture", quantity: 48, available: 36, status: "Reserved", tone: "sand", symbol: "BC" },
  { id: 2, name: "Amber bud vase", category: "Tabletop", quantity: 72, available: 72, status: "Available", tone: "amber", symbol: "AV" },
  { id: 3, name: "Linen napkin · Sage", category: "Textiles", quantity: 120, available: 84, status: "Rented", tone: "sage", symbol: "LN" },
  { id: 4, name: "Rattan lantern · Large", category: "Lighting", quantity: 18, available: 14, status: "Reserved", tone: "clay", symbol: "RL" },
  { id: 5, name: "Fluted plinth · Ivory", category: "Structures", quantity: 8, available: 8, status: "Available", tone: "ivory", symbol: "FP" },
  { id: 6, name: "Stone candle holder", category: "Tabletop", quantity: 34, available: 28, status: "Available", tone: "stone", symbol: "SC" },
];

const seedReservations: Reservation[] = [
  { id: 1, item: "Bentwood dining chairs × 12", client: "Maya & Tom · Casa Flora", date: "2026-07-28", endDate: "2026-07-29", color: "#bb6242" },
  { id: 2, item: "Rattan lanterns × 4", client: "Luma Events", date: "2026-07-30", endDate: "2026-07-31", color: "#778567" },
  { id: 3, item: "Linen napkins × 36", client: "Sofia & Liam · The Glasshouse", date: "2026-08-01", endDate: "2026-08-02", color: "#c3974d" },
];

const seedProfile: Profile = {
  businessName: "Terra & Table",
  handle: "terraandtable",
  bio: "Warm, considered event styling and soulful tablescapes for weddings and intimate gatherings.",
  location: "Maputo, Mozambique",
  phone: "+258 84 555 0192",
  email: "hello@terraandtable.co",
  color: "#b75d3f",
};

const monthDays = [
  { n: 29, muted: true }, { n: 30, muted: true }, { n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 },
  { n: 6 }, { n: 7 }, { n: 8 }, { n: 9 }, { n: 10 }, { n: 11 }, { n: 12 },
  { n: 13 }, { n: 14 }, { n: 15 }, { n: 16 }, { n: 17 }, { n: 18 }, { n: 19 },
  { n: 20 }, { n: 21 }, { n: 22 }, { n: 23 }, { n: 24 }, { n: 25 }, { n: 26 },
  { n: 27 }, { n: 28 }, { n: 29 }, { n: 30 }, { n: 31 }, { n: 1, muted: true }, { n: 2, muted: true },
];

const networkItems = [
  { name: "Clear ghost chair", owner: "Aster Events", distance: "2.4 km", available: 42, price: "$7 / day", symbol: "GC", tone: "mist", rating: "4.9" },
  { name: "Brass table lamp", owner: "Gather & Glow", distance: "4.8 km", available: 12, price: "$16 / day", symbol: "BL", tone: "gold", rating: "4.8" },
  { name: "White sailcloth tent", owner: "Marée Rentals", distance: "8.1 km", available: 2, price: "$240 / day", symbol: "ST", tone: "ivory", rating: "5.0" },
  { name: "Cane lounge set", owner: "Olive House", distance: "11 km", available: 3, price: "$85 / day", symbol: "CL", tone: "sage", rating: "4.7" },
];

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "home", label: "Overview", icon: "⌂" },
  { id: "storage", label: "Storage", icon: "▦" },
  { id: "calendar", label: "Calendar", icon: "□" },
  { id: "network", label: "Nearby network", icon: "◎" },
  { id: "profile", label: "Public profile", icon: "◇" },
];

function cls(...names: (string | false | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

export default function DecorApp() {
  const [view, setView] = useState<View>("home");
  const [items, setItems] = useState<Item[]>(seedItems);
  const [reservations, setReservations] = useState<Reservation[]>(seedReservations);
  const [profile, setProfile] = useState<Profile>(seedProfile);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All items");
  const [addOpen, setAddOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [networkQuery, setNetworkQuery] = useState("");
  const [requested, setRequested] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<"Basic" | "Network">("Network");

  useEffect(() => {
    fetch("/api/data")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (data.items?.length) setItems(data.items);
        if (data.reservations?.length) setReservations(data.reservations);
        if (data.profile) setProfile({ ...seedProfile, ...data.profile });
      })
      .catch(() => {
        // The seeded demo remains fully usable if local database bindings are unavailable.
      });
  }, []);

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
      return matchesQuery && matchesFilter;
    });
  }, [items, query, filter]);

  const filteredNetwork = useMemo(() => {
    const normalized = networkQuery.toLowerCase();
    return networkItems.filter((item) =>
      `${item.name} ${item.owner}`.toLowerCase().includes(normalized),
    );
  }, [networkQuery]);

  const showToast = (message: string) => setToast(message);

  async function persist(action: string, payload: unknown) {
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
    } catch {
      // Optimistic UI stays available in a local-only preview.
    }
  }

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const category = String(form.get("category") || "Furniture");
    const quantity = Number(form.get("quantity") || 1);
    if (!name) return;
    const item: Item = {
      id: Date.now(),
      name,
      category,
      quantity,
      available: quantity,
      status: "Available",
      tone: "clay",
      symbol: name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase(),
    };
    setItems((current) => [item, ...current]);
    setAddOpen(false);
    showToast(`${name} added to Storage`);
    await persist("addItem", item);
  }

  async function handleReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem) return;
    const form = new FormData(event.currentTarget);
    const reservation: Reservation = {
      id: Date.now(),
      item: `${selectedItem.name} × ${form.get("quantity") || 1}`,
      client: String(form.get("client") || "New reservation"),
      date: String(form.get("start")),
      endDate: String(form.get("end")),
      color: profile.color,
    };
    setReservations((current) => [reservation, ...current]);
    setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, status: "Reserved" } : item));
    setReserveOpen(false);
    showToast(`Dates reserved for ${selectedItem.name}`);
    await persist("addReservation", reservation);
  }

  async function saveProfile() {
    setSaving(true);
    await persist("updateProfile", profile);
    window.setTimeout(() => {
      setSaving(false);
      showToast("Public profile updated");
    }, 450);
  }

  function openReserve(item: Item) {
    setSelectedItem(item);
    setReserveOpen(true);
  }

  return (
    <main className="app-shell" style={{ "--brand": profile.color } as React.CSSProperties}>
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("home")} aria-label="Trove home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Trove</span>
        </button>
        <div className="workspace-chip">
          <span className="workspace-avatar">T</span>
          <span><strong>Terra & Table</strong><small>{plan} plan</small></span>
          <b>⌄</b>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setView(item.id)} className={cls(view === item.id && "active")}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.id === "network" && <em>PRO</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => setView("plans")} className={cls("plan-card", view === "plans" && "active")}>
            <span className="plan-orbit">✦</span>
            <span><strong>{plan} plan</strong><small>{plan === "Network" ? "Unlimited team · Local rentals" : "Inventory essentials"}</small></span>
            <span>›</span>
          </button>
          <button className="user-row" onClick={() => setView("profile")}>
            <span className="user-avatar">AM</span>
            <span><strong>Amelia Moss</strong><small>Owner</small></span>
            <span>•••</span>
          </button>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <button className="mobile-logo" onClick={() => setView("home")}><span className="brand-mark"><i /><i /><i /></span>Trove</button>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Search" onClick={() => setView("storage")}>⌕</button>
            <button className="icon-button notification" aria-label="Notifications">♢<i /></button>
            <div className="team-faces" aria-label="3 team members">
              <span>AM</span><span>JR</span><span>SK</span>
              <button onClick={() => showToast("Team invite link copied")} aria-label="Invite teammate">+</button>
            </div>
          </div>
        </header>

        <div className="page-content">
          {view === "home" && (
            <Overview
              items={items}
              reservations={reservations}
              setView={setView}
              openAdd={() => setAddOpen(true)}
              openReserve={openReserve}
            />
          )}
          {view === "storage" && (
            <Storage
              items={filteredItems}
              query={query}
              setQuery={setQuery}
              filter={filter}
              setFilter={setFilter}
              openAdd={() => setAddOpen(true)}
              openReserve={openReserve}
              removeItem={(item) => {
                setItems((current) => current.filter((candidate) => candidate.id !== item.id));
                persist("removeItem", { id: item.id });
                showToast(`${item.name} removed`);
              }}
            />
          )}
          {view === "calendar" && <Calendar reservations={reservations} openAdd={() => { setSelectedItem(items[0] || null); setReserveOpen(true); }} />}
          {view === "network" && (
            <Network
              plan={plan}
              query={networkQuery}
              setQuery={setNetworkQuery}
              items={filteredNetwork}
              requested={requested}
              onRequest={(name) => {
                setRequested((current) => [...current, name]);
                showToast(`Request sent for ${name}`);
              }}
              openPlans={() => setView("plans")}
            />
          )}
          {view === "profile" && <ProfileEditor profile={profile} setProfile={setProfile} save={saveProfile} saving={saving} />}
          {view === "plans" && <Plans plan={plan} choose={(next) => { setPlan(next); showToast(`${next} plan selected`); }} />}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 4).map((item) => (
          <button key={item.id} className={cls(view === item.id && "active")} onClick={() => setView(item.id)}>
            <span>{item.icon}</span><small>{item.id === "network" ? "Network" : item.label}</small>
          </button>
        ))}
        <button className={cls(view === "profile" && "active")} onClick={() => setView("profile")}><span>◇</span><small>Profile</small></button>
      </nav>

      {addOpen && (
        <Modal title="Add to Storage" subtitle="Create an inventory record your whole team can see." onClose={() => setAddOpen(false)}>
          <form onSubmit={handleAddItem} className="modal-form">
            <label>Item name<input name="name" placeholder="e.g. Travertine plinth" autoFocus required /></label>
            <div className="form-grid">
              <label>Category<select name="category"><option>Furniture</option><option>Tabletop</option><option>Textiles</option><option>Lighting</option><option>Structures</option></select></label>
              <label>Quantity<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
            </div>
            <label>Storage location<input name="location" placeholder="Aisle B · Shelf 04" /></label>
            <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setAddOpen(false)}>Cancel</button><button className="button-primary">Add item</button></div>
          </form>
        </Modal>
      )}

      {reserveOpen && selectedItem && (
        <Modal title="Reserve item" subtitle={selectedItem.name} onClose={() => setReserveOpen(false)}>
          <form onSubmit={handleReservation} className="modal-form">
            <label>Client or event<input name="client" placeholder="e.g. Rivera wedding" required /></label>
            <div className="form-grid">
              <label>Start date<input name="start" type="date" defaultValue="2026-08-08" required /></label>
              <label>End date<input name="end" type="date" defaultValue="2026-08-09" required /></label>
            </div>
            <label>Quantity<input name="quantity" type="number" min="1" max={selectedItem.available} defaultValue="1" required /></label>
            <div className="availability-note"><span>✓</span> {selectedItem.available} currently available for these dates</div>
            <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setReserveOpen(false)}>Cancel</button><button className="button-primary">Confirm reservation</button></div>
          </form>
        </Modal>
      )}

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{detail}</p></div>{action}</div>;
}

function Overview({ items, reservations, setView, openAdd, openReserve }: { items: Item[]; reservations: Reservation[]; setView: (view: View) => void; openAdd: () => void; openReserve: (item: Item) => void }) {
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  const available = items.reduce((sum, item) => sum + item.available, 0);
  return (
    <>
      <PageHeading eyebrow="MONDAY, 27 JULY" title="Good morning, Amelia." detail="Here’s what’s happening across your collection today." action={<button className="button-primary" onClick={openAdd}><span>＋</span>Add item</button>} />
      <section className="stat-grid">
        <article><div className="stat-icon terracotta">▦</div><div><span>Total items</span><strong>{total}</strong><small><b>+12</b> this month</small></div></article>
        <article><div className="stat-icon olive">✓</div><div><span>Available now</span><strong>{available}</strong><small>{Math.round((available / total) * 100)}% of collection</small></div></article>
        <article><div className="stat-icon gold">□</div><div><span>Out this week</span><strong>24</strong><small>Across 3 events</small></div></article>
        <article><div className="stat-icon lilac">◎</div><div><span>Network earnings</span><strong>$1,240</strong><small><b>↑ 18%</b> this month</small></div></article>
      </section>
      <section className="overview-grid">
        <article className="card schedule-card">
          <div className="card-heading"><div><span className="eyebrow">THIS WEEK</span><h2>Upcoming movements</h2></div><button onClick={() => setView("calendar")}>View calendar <span>→</span></button></div>
          <div className="schedule-list">
            {reservations.slice(0, 3).map((reservation, index) => (
              <button key={reservation.id} className="schedule-row" onClick={() => setView("calendar")}>
                <span className="date-block"><b>{index === 0 ? "TUE" : index === 1 ? "THU" : "SAT"}</b><strong>{new Date(`${reservation.date}T00:00:00`).getDate()}</strong></span>
                <span className="schedule-line" style={{ background: reservation.color }} />
                <span className="schedule-copy"><strong>{reservation.item}</strong><small>{reservation.client}</small></span>
                <span className={cls("status-pill", index === 0 ? "pickup" : index === 1 ? "delivery" : "return")}>{index === 0 ? "Pickup" : index === 1 ? "Delivery" : "Return"}</span>
                <span className="row-arrow">›</span>
              </button>
            ))}
          </div>
        </article>
        <article className="card pulse-card">
          <div className="card-heading"><div><span className="eyebrow">STORAGE PULSE</span><h2>Collection health</h2></div><button aria-label="More options">•••</button></div>
          <div className="donut-wrap"><div className="donut"><span><strong>78%</strong><small>in use</small></span></div><div className="legend"><p><i className="dot available" />Available <b>{available}</b></p><p><i className="dot reserved" />Reserved <b>48</b></p><p><i className="dot rented" />Rented out <b>36</b></p><p><i className="dot maintenance" />Maintenance <b>6</b></p></div></div>
          <div className="capacity"><span><b>Storage capacity</b><small>620 of 800 slots</small></span><div><i /></div></div>
        </article>
      </section>
      <section className="card recent-card">
        <div className="card-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h2>Recently updated</h2></div><button onClick={() => setView("storage")}>Open Storage <span>→</span></button></div>
        <div className="mini-item-grid">
          {items.slice(0, 4).map((item) => <ItemCard key={item.id} item={item} compact onReserve={() => openReserve(item)} />)}
        </div>
      </section>
    </>
  );
}

function Storage({ items, query, setQuery, filter, setFilter, openAdd, openReserve, removeItem }: { items: Item[]; query: string; setQuery: (value: string) => void; filter: string; setFilter: (value: string) => void; openAdd: () => void; openReserve: (item: Item) => void; removeItem: (item: Item) => void }) {
  return (
    <>
      <PageHeading eyebrow="INVENTORY" title="Storage" detail="A live view of everything you own, where it is, and when it’s available." action={<button className="button-primary" onClick={openAdd}><span>＋</span>Add item</button>} />
      <div className="toolbar">
        <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your collection…" /></label>
        <div className="filter-pills">
          {["All items", "Available", "Reserved", "Rented"].map((value) => <button key={value} className={cls(filter === value && "active")} onClick={() => setFilter(value)}>{value}</button>)}
        </div>
        <button className="button-secondary">⇅ Sort</button>
      </div>
      <div className="collection-summary"><span><b>{items.length}</b> item types</span><span><b>386</b> individual pieces</span><span><i />Synced just now</span></div>
      {items.length ? <div className="storage-grid">{items.map((item) => <ItemCard key={item.id} item={item} onReserve={() => openReserve(item)} onRemove={() => removeItem(item)} />)}</div> : <div className="empty-state"><span>⌕</span><h3>No items found</h3><p>Try another search or add something new to your Storage.</p></div>}
    </>
  );
}

function ItemCard({ item, compact, onReserve, onRemove }: { item: Item; compact?: boolean; onReserve: () => void; onRemove?: () => void }) {
  return (
    <article className={cls("item-card", compact && "compact")}>
      <div className={cls("item-visual", item.tone)}><span>{item.symbol}</span><button aria-label={`Favorite ${item.name}`}>♡</button></div>
      <div className="item-info">
        <span className="item-category">{item.category}</span>
        <h3>{item.name}</h3>
        <div className="item-meta"><span><b>{item.available}</b> / {item.quantity} available</span><span className={cls("status-dot", item.status.toLowerCase())}>{item.status}</span></div>
        {!compact && <div className="item-card-actions"><button onClick={onReserve}>Reserve dates</button>{onRemove && <button onClick={onRemove} aria-label={`Remove ${item.name}`}>•••</button>}</div>}
      </div>
    </article>
  );
}

function Calendar({ reservations, openAdd }: { reservations: Reservation[]; openAdd: () => void }) {
  return (
    <>
      <PageHeading eyebrow="SCHEDULE" title="Calendar" detail="Every pickup, return, and reservation in one shared team view." action={<button className="button-primary" onClick={openAdd}><span>＋</span>New reservation</button>} />
      <section className="calendar-layout">
        <article className="card calendar-card">
          <div className="calendar-toolbar"><button>‹</button><h2>July 2026</h2><button>›</button><button className="today-button">Today</button><div className="calendar-view-toggle"><button className="active">Month</button><button>List</button></div></div>
          <div className="calendar-grid">
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <div className="weekday" key={day}>{day}</div>)}
            {monthDays.map((day, index) => {
              const event = !day.muted && (day.n === 28 || day.n === 30 || day.n === 31);
              return <div className={cls("calendar-day", day.muted && "muted", day.n === 27 && !day.muted && "today")} key={`${day.n}-${index}`}><span>{day.n}</span>{event && <button style={{ "--event": day.n === 28 ? "#b75d3f" : day.n === 30 ? "#778567" : "#c3974d" } as React.CSSProperties}>{day.n === 28 ? "Chairs · Casa Flora" : day.n === 30 ? "Lanterns · Luma" : "Napkins · Glasshouse"}</button>}</div>;
            })}
          </div>
        </article>
        <aside className="card agenda-card">
          <span className="eyebrow">UP NEXT</span><h2>Monday, 27 July</h2>
          <div className="agenda-empty"><span>☼</span><strong>A calm day</strong><p>No movements today. Your next pickup is tomorrow at 09:30.</p></div>
          <div className="agenda-next"><span className="time">TUE<br /><b>28</b></span><span><small>09:30 · PICKUP</small><strong>Bentwood dining chairs × 12</strong><p>Casa Flora · Maya & Tom</p></span></div>
          <h3>Team availability</h3>
          <div className="team-list"><span><i className="face clay">AM</i><b>Amelia</b><small>Available</small><em>●</em></span><span><i className="face olive">JR</i><b>Jonah</b><small>Delivery · 10–12</small><em>●</em></span><span><i className="face gold">SK</i><b>Sara</b><small>Available after 13:00</small><em>●</em></span></div>
        </aside>
      </section>
      <section className="card reservation-list">
        <div className="card-heading"><div><span className="eyebrow">RESERVATIONS</span><h2>Coming up</h2></div><button>Export schedule ↓</button></div>
        {reservations.map((reservation) => <div className="reservation-row" key={reservation.id}><i style={{ background: reservation.color }} /><span><strong>{reservation.item}</strong><small>{reservation.client}</small></span><span><strong>{new Date(`${reservation.date}T00:00:00`).toLocaleDateString("en", { day: "numeric", month: "short" })} — {new Date(`${reservation.endDate}T00:00:00`).toLocaleDateString("en", { day: "numeric", month: "short" })}</strong><small>2 days</small></span><span className="status-pill pickup">Confirmed</span><button>•••</button></div>)}
      </section>
    </>
  );
}

function Network({ plan, query, setQuery, items, requested, onRequest, openPlans }: { plan: string; query: string; setQuery: (value: string) => void; items: typeof networkItems; requested: string[]; onRequest: (name: string) => void; openPlans: () => void }) {
  if (plan !== "Network") return <section className="locked-network"><div className="network-orbit">◎</div><span className="eyebrow">TROVE NETWORK</span><h1>More inventory, without more storage.</h1><p>Search trusted decorators nearby, check live availability, and request the pieces your next event needs.</p><button className="button-primary" onClick={openPlans}>Explore Network plan</button></section>;
  return (
    <>
      <PageHeading eyebrow="TROVE NETWORK" title="Find it nearby." detail="Borrow from trusted decorators in your area and turn idle stock into income." action={<button className="button-secondary">My rental requests <span>3</span></button>} />
      <section className="network-hero">
        <div><span className="eyebrow">SEARCH 24,000+ LOCAL PIECES</span><h2>What does your next event need?</h2><label className="network-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “ghost chairs” or “linen napkins”…" /><button>Search</button></label><div className="popular-searches"><small>Popular:</small>{["Plinths", "Chairs", "Bud vases", "Candle holders"].map((term) => <button key={term} onClick={() => setQuery(term)}>{term}</button>)}</div></div>
        <div className="network-map"><span className="map-road one" /><span className="map-road two" /><span className="map-road three" /><i className="map-pin p1">12</i><i className="map-pin p2">8</i><i className="map-pin p3">4</i><i className="map-you">YOU</i></div>
      </section>
      <div className="network-heading"><div><h2>Available near Maputo</h2><p>Verified businesses · Availability for the next 30 days</p></div><button className="button-secondary">Within 25 km⌄</button></div>
      <div className="network-grid">
        {items.map((item) => (
          <article className="network-card" key={item.name}>
            <div className={cls("network-visual", item.tone)}><span>{item.symbol}</span><em>{item.available} available</em></div>
            <div className="network-info"><div className="network-owner"><i>{item.owner.split(" ").map((word) => word[0]).join("").slice(0, 2)}</i><span><strong>{item.owner} <b>✓</b></strong><small>★ {item.rating} · {item.distance}</small></span></div><h3>{item.name}</h3><div className="network-price"><strong>{item.price}</strong><button disabled={requested.includes(item.name)} onClick={() => onRequest(item.name)}>{requested.includes(item.name) ? "Requested ✓" : "Check dates"}</button></div></div>
          </article>
        ))}
      </div>
    </>
  );
}

function ProfileEditor({ profile, setProfile, save, saving }: { profile: Profile; setProfile: (profile: Profile) => void; save: () => void; saving: boolean }) {
  const colors = ["#b75d3f", "#78836a", "#ba914d", "#3f5f68", "#755f72", "#303634"];
  const update = (key: keyof Profile, value: string) => setProfile({ ...profile, [key]: value });
  return (
    <>
      <PageHeading eyebrow="YOUR BUSINESS" title="Public profile" detail="Make a polished first impression with a profile that feels like your brand." action={<button className="button-primary" onClick={save}>{saving ? "Saving…" : "Save changes"}</button>} />
      <section className="profile-layout">
        <div className="profile-editor card">
          <div className="section-title"><span>01</span><div><h2>Business identity</h2><p>The essentials clients and fellow decorators will see.</p></div></div>
          <div className="avatar-edit"><div className="profile-avatar" style={{ background: profile.color }}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : profile.businessName.split(" ").map((word) => word[0]).join("").slice(0, 2)}</div><span><strong>Profile picture</strong><small>JPG or PNG · Max 5 MB</small><label className="button-secondary">Choose image<input type="file" accept="image/png,image/jpeg" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const body = new FormData();
            body.append("file", file);
            try {
              const response = await fetch("/api/profile-image", { method: "POST", body });
              if (response.ok) {
                const data = await response.json();
                update("avatarUrl", data.url);
              }
            } catch { /* Preview stays usable without upload binding. */ }
          }} /></label></span></div>
          <div className="form-grid"><label>Business name<input value={profile.businessName} onChange={(event) => update("businessName", event.target.value)} /></label><label>Profile address<span className="input-prefix">trove.co/<input value={profile.handle} onChange={(event) => update("handle", event.target.value)} /></span></label></div>
          <label>Bio<textarea rows={4} maxLength={220} value={profile.bio} onChange={(event) => update("bio", event.target.value)} /><small className="char-count">{profile.bio.length}/220</small></label>
          <div className="divider" />
          <div className="section-title"><span>02</span><div><h2>Brand colour</h2><p>Choose a tone inspired by leading décor brands.</p></div></div>
          <div className="color-picker">{colors.map((color) => <button aria-label={`Choose ${color}`} key={color} style={{ background: color }} className={cls(profile.color === color && "active")} onClick={() => update("color", color)}><span>✓</span></button>)}</div>
          <div className="divider" />
          <div className="section-title"><span>03</span><div><h2>Contact details</h2><p>Help visitors get in touch directly.</p></div></div>
          <div className="form-grid"><label>Location<input value={profile.location} onChange={(event) => update("location", event.target.value)} /></label><label>Phone<input value={profile.phone} onChange={(event) => update("phone", event.target.value)} /></label></div>
          <label>Email address<input value={profile.email} onChange={(event) => update("email", event.target.value)} /></label>
        </div>
        <aside className="profile-preview-wrap"><div className="preview-label"><span className="eyebrow">LIVE PREVIEW</span><button>↗ Open public page</button></div><div className="public-profile-card"><div className="profile-cover" style={{ background: profile.color }}><span /><span /></div><div className="public-content"><div className="public-avatar" style={{ background: profile.color }}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : profile.businessName.split(" ").map((word) => word[0]).join("").slice(0, 2)}</div><span className="verified">VERIFIED DECORATOR · <b>✓</b></span><h2>{profile.businessName}</h2><p>{profile.bio}</p><small>⌖ {profile.location}</small><div className="public-actions"><button style={{ background: profile.color }}>Send an enquiry</button><button>♡</button></div><div className="public-stats"><span><strong>184</strong><small>pieces</small></span><span><strong>4.9</strong><small>rating</small></span><span><strong>6 yrs</strong><small>in business</small></span></div></div></div><p className="preview-footnote">Changes appear here instantly. Save when you’re happy with the result.</p></aside>
      </section>
    </>
  );
}

function Plans({ plan, choose }: { plan: "Basic" | "Network"; choose: (plan: "Basic" | "Network") => void }) {
  return (
    <>
      <PageHeading eyebrow="SUBSCRIPTION" title="A plan that grows with you." detail="Start with beautifully simple inventory, then unlock the power of your local décor community." />
      <section className="billing-toggle"><button className="active">Monthly</button><button>Yearly <span>Save 20%</span></button></section>
      <section className="plans-grid">
        <article className={cls("pricing-card", plan === "Basic" && "current")}><span className="plan-label">STORAGE</span><h2>Basic</h2><p>Everything a small décor team needs to stay organised.</p><div className="price"><strong>$19</strong><span>/ month<br /><small>per business</small></span></div><button className="button-secondary" onClick={() => choose("Basic")}>{plan === "Basic" ? "Current plan" : "Choose Basic"}</button><ul><li>✓ Unlimited inventory items</li><li>✓ Shared reservation calendar</li><li>✓ Up to 3 team members</li><li>✓ Custom public profile</li><li>✓ CSV exports</li></ul></article>
        <article className={cls("pricing-card featured", plan === "Network" && "current")}><span className="recommended">MOST POPULAR</span><span className="plan-label">STORAGE + NETWORK</span><h2>Network</h2><p>Manage your own collection and expand it through trusted local partners.</p><div className="price"><strong>$49</strong><span>/ month<br /><small>per business</small></span></div><button className="button-primary" onClick={() => choose("Network")}>{plan === "Network" ? "Current plan" : "Upgrade to Network"}</button><ul><li>✓ Everything in Basic</li><li>✓ Search nearby decorator stock</li><li>✓ Request and accept rentals</li><li>✓ Set your own pricing & terms</li><li>✓ Unlimited team members</li><li>✓ Network earnings dashboard</li></ul></article>
      </section>
      <section className="plan-note"><span>♡</span><div><strong>Built for how decorators actually work.</strong><p>No contracts. Switch or cancel anytime. Your inventory exports with you.</p></div><button>Read common questions →</button></section>
    </>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">TROVE STORAGE</span><h2>{title}</h2><p>{subtitle}</p>{children}</section></div>;
}
