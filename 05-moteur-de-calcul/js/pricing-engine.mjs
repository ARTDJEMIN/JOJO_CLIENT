/**
 * Moteur de calcul Jojo — implémentation de référence (fonction pure).
 * Toutes les valeurs viennent de la configuration (04-configuration/pricing-config.json).
 * Aucune constante métier n'est codée ici.
 *
 * estimate(input, config) -> {
 *   formula, truck, helpers, estimatedHours, hours, onSiteHours,
 *   kmIncluded, lines: [{code, label, amount}], total, alerts: [], configVersion
 * }
 */

const r2 = (x) => Math.round(x * 100) / 100;

export class PricingError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/* ---------- 1. Volume ---------- */
export function computeVolume(input, cfg) {
  const vp = cfg.volume_policy;
  if (Array.isArray(input.items) && input.items.length && vp.list_overrides_surface) {
    return input.items.reduce((s, it) => s + (it.volumeM3 || 0) * (it.qty || 0), 0);
  }
  if (typeof input.volumeM3 === 'number') return input.volumeM3;
  let surface = input.surfaceM2;
  if (surface == null && input.homeType) surface = vp.home_type_surfaces_m2[input.homeType];
  if (surface == null) return 0;
  return (surface * vp.surface_height_m) / vp.surface_divisor;
}

/* ---------- 2. Camion ---------- */
export function chooseTruck(service, volume, cfg) {
  if (service === 'gros_bras') return 'NONE';
  if (volume > cfg.volume_policy.quote_above_m3) return null; // sortie en devis
  const trucks = cfg.trucks.filter((t) => t.capacity_m3 > 0).sort((a, b) => a.capacity_m3 - b.capacity_m3);
  const t = trucks.find((tr) => volume <= tr.capacity_m3);
  return t ? t.code : null;
}

/* ---------- 3. Formule ---------- */
export function selectFormula(truck, helpers, cfg) {
  const row = cfg.selection_matrix[truck] || {};
  const code = row[String(helpers)];
  if (!code) {
    const valid = Object.keys(row).map(Number);
    throw new PricingError('formula_unavailable',
      `Aucune formule pour ${truck} avec ${helpers} Gros Bras (valeurs possibles : ${valid.join(', ') || 'aucune'})`);
  }
  return cfg.formulas.find((f) => f.code === code);
}

/* ---------- 4. Durée estimée ---------- */
export function estimateDuration(input, formula, volume, cfg) {
  const dm = cfg.duration_modifiers;
  const N = formula.helpers;
  const travelH = (input.travelMinutes || 0) / 60;
  const addresses = input.addresses || [];
  const truck = cfg.trucks.find((t) => t.code === formula.truck);
  const fillRatio = truck && truck.capacity_m3 ? volume / truck.capacity_m3 : 0;
  const fullTruck = input.service === 'demenagement' || fillRatio >= dm.full_truck_minimum.fill_ratio;
  const perSideMin = fullTruck && dm.full_truck_minimum.per_side_hours[formula.truck] ? dm.full_truck_minimum.per_side_hours[formula.truck] : 0;
  const ignoreAccess = N === 0 && dm.self_loading_ignores_access;

  let handling = 0;
  let floorsNoLift = 0;
  for (const a of addresses) {
    let base = a.handlingHours != null ? a.handlingHours : 0;
    if (perSideMin) base = Math.max(base, perSideMin);
    let pct = 0;
    if (!ignoreAccess) {
      const floor = a.floor || 0;
      const noLift = !a.lift;
      if (noLift && floor > 0) floorsNoLift += floor;
      if (noLift && floor >= dm.floor_no_lift.from_floor && !(a.personPerLanding && dm.floor_no_lift.cancelled_by_person_per_landing)) {
        pct += (floor - (dm.floor_no_lift.from_floor - 1)) * dm.floor_no_lift.pct_per_floor;
      }
      const steps = dm.carry_distance.count_started_step
        ? Math.ceil((a.carryM || 0) / dm.carry_distance.step_m)
        : Math.floor((a.carryM || 0) / dm.carry_distance.step_m);
      pct += steps * dm.carry_distance.pct_per_step;
    }
    handling += base * (1 + pct / 100);
  }
  let stairs = 0;
  if (!ignoreAccess && floorsNoLift >= dm.three_floors_total_no_lift.threshold_floors) {
    stairs = dm.three_floors_total_no_lift.fixed_hours;
  }
  const stopovers = (input.stopovers || []).reduce((s, st) => s + (st.minutes || 0) / 60, 0);
  return travelH + handling + stairs + stopovers;
}

/* ---------- 5. Palier ---------- */
export function choosePalier(estimatedHours, formula, input, cfg) {
  const est = Math.max(formula.min_hours, Math.ceil(estimatedHours - 1e-9));
  const extra = Math.min(Math.max(input.extraHours || 0, 0), cfg.duration_policy.max_extra_hours_over_estimate);
  let hours = input.chosenHours != null ? input.chosenHours : est + extra;
  const maxAllowed = Math.min(formula.max_hours, est + cfg.duration_policy.max_extra_hours_over_estimate);
  hours = Math.min(Math.max(hours, formula.min_hours), Math.max(maxAllowed, formula.min_hours));
  return { estimated: Math.min(est, formula.max_hours), hours };
}

/* ---------- 6. Heures dans un créneau majoré ---------- */
function minutesOfDay(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function inSlot(min, slot) {
  const a = minutesOfDay(slot.from), b = minutesOfDay(slot.to);
  return a < b ? min >= a && min < b : min >= a || min < b;
}
export function hoursPerSlot(startAt, hours, cfg) {
  const out = {};
  if (!startAt) return out;
  const m = /T(\d{2}):(\d{2})/.exec(startAt);
  if (!m) return out;
  let t = Number(m[1]) * 60 + Number(m[2]);
  for (let i = 0; i < hours * 60; i++, t = (t + 1) % 1440) {
    for (const s of cfg.price_modifiers.time_slots) if (inSlot(t, s)) out[s.code] = (out[s.code] || 0) + 1 / 60;
  }
  return out;
}

/* ---------- Moteur ---------- */
export function estimate(input, cfg) {
  const alerts = [];
  const lines = [];
  const volume = computeVolume(input, cfg);

  let truck = input.truck || chooseTruck(input.service, volume, cfg);
  if (truck === null) {
    return { quoteRequired: true, reason: 'volume_above_limit', volume, configVersion: cfg.version, alerts: ['Volume supérieur à ' + cfg.volume_policy.quote_above_m3 + ' m³ : sortie en devis.'] };
  }
  const helpers = input.helpers != null ? input.helpers : (truck === 'NONE' ? 1 : 0);
  const formula = selectFormula(truck, helpers, cfg);

  const estimatedHours = input.estimatedHoursOverride != null ? input.estimatedHoursOverride : estimateDuration(input, formula, volume, cfg);
  const { estimated, hours } = choosePalier(estimatedHours, formula, input, cfg);
  if (hours < estimated) alerts.push('Durée réservée inférieure à la durée estimée : risque de dépassement facturé à la minute.');

  const tier = formula.tiers.find((t) => t.hours === hours);
  if (!tier) throw new PricingError('tier_missing', `Pas de palier ${hours} h pour ${formula.code}`);

  const lp = cfg.labor;
  const pm = cfg.price_modifiers;
  const isGrosBras = formula.truck === 'NONE';
  const crew = isGrosBras ? (input.grosBrasCount || 1) : formula.helpers;
  const heavy = !!input.heavyItem;

  // Prix de base
  let base = tier.price;
  if (isGrosBras && pm.gros_bras_price_per_helper) base = tier.price * crew;
  lines.push({ code: 'BASE', label: `${formula.label} · ${isGrosBras ? crew + ' × ' : ''}${hours} h`, amount: r2(base) });

  // Charge lourde
  if (heavy) {
    if (isGrosBras) {
      lines.push({ code: 'HEAVY', label: 'Charge lourde (+ ' + Math.round((pm.gros_bras_heavy_multiplier - 1) * 100) + ' %)', amount: r2(base * (pm.gros_bras_heavy_multiplier - 1)) });
    } else if (crew > 0) {
      lines.push({ code: 'HEAVY', label: `Charge lourde · ${crew} Gros Bras × ${hours} h`, amount: r2((lp.heavy_item_hourly_rate - lp.hourly_rate) * crew * hours) });
    }
  }

  // Objets spécifiques (piano, coffre-fort, frigo américain) — hypothèse : s'ajoute à la grille
  if (input.specialItems && input.specialItems > 0) {
    const persons = crew + (isGrosBras ? 0 : 1);
    lines.push({ code: 'SPECIAL', label: `Objet spécifique · ${persons} personnes × ${hours} h`, amount: r2(lp.special_item_hourly_rate_per_person * persons * hours) });
  }

  // Kilomètres
  const D = input.distanceKm || 0;
  const extraKm = Math.max(0, D - tier.km_included);
  if (extraKm > 0) {
    if (formula.extra_km_rate == null) alerts.push(`Tarif au km non défini pour ${formula.label} : ${r2(extraKm)} km au-delà de l'inclus non facturés.`);
    else lines.push({ code: 'EXTRA_KM', label: `Kilomètres · ${r2(extraKm)} km au-delà des ${tier.km_included} inclus`, amount: r2(extraKm * formula.extra_km_rate) });
  }

  // Majoration horaire (main-d'œuvre seule)
  const slotHours = hoursPerSlot(input.startAt, hours, cfg);
  const laborPerHour = isGrosBras ? base * (heavy ? pm.gros_bras_heavy_multiplier : 1) / hours : crew * (heavy ? lp.heavy_item_hourly_rate : lp.hourly_rate);
  for (const s of pm.time_slots) {
    const h = slotHours[s.code] || 0;
    if (h > 0 && laborPerHour > 0) lines.push({ code: 'SLOT_' + s.code, label: `Majoration ${s.from}–${s.to} · ${r2(h)} h × ${s.pct_on_labor} %`, amount: r2(laborPerHour * h * s.pct_on_labor / 100) });
  }

  // Objets volumineux au 3e étage sans ascenseur
  for (const a of input.addresses || []) {
    if (!a.lift && (a.floor || 0) >= 3 && a.bulkyItems) {
      lines.push({ code: 'BULKY_FLOOR3', label: `Objets volumineux · ${a.bulkyItems} × étage ${a.floor}`, amount: r2(a.bulkyItems * pm.bulky_item_floor3_no_lift.eur_per_item_per_address) });
    }
  }

  // Frais de dossier
  if (input.channel === 'phone') lines.push({ code: 'PHONE_FEE', label: 'Frais de dossier (réservation par téléphone)', amount: pm.phone_booking_fee });

  const total = r2(lines.reduce((s, l) => s + l.amount, 0));
  const onSiteHours = formula.pause && hours >= formula.pause.from_hours ? hours + formula.pause.hours : hours;

  return {
    quoteRequired: false,
    formula: formula.code, formulaLabel: formula.label, truck, helpers: crew,
    volume: r2(volume), estimatedHours: r2(estimatedHours), estimatedPalier: estimated, hours, onSiteHours,
    kmIncluded: tier.km_included, overtimePerMin: formula.overtime_per_min,
    lines, total, alerts, configVersion: cfg.version
  };
}

/* ---------- Annulation ---------- */
export function cancellationFee(formulaCode, hoursBeforeStart, noShow, cfg) {
  const f = cfg.formulas.find((x) => x.code === formulaCode);
  const minPrice = f.tiers.find((t) => t.hours === f.min_hours).price;
  const cp = cfg.cancellation_policy;
  if (noShow) return r2(minPrice * cp.no_show_ratio_of_min_price);
  if (hoursBeforeStart >= cp.free_until_hours_before) return 0;
  return r2(minPrice * cp.late_cancel_ratio_of_min_price);
}

/* ---------- Dépassement ---------- */
export function overtimeAmount(formulaCode, bookedHours, actualMinutes, waitingMinutes, cfg) {
  const f = cfg.formulas.find((x) => x.code === formulaCode);
  const over = Math.max(0, actualMinutes - bookedHours * 60);
  const wait = Math.max(0, (waitingMinutes || 0) - cfg.cancellation_policy.waiting_free_minutes);
  return r2((over + wait) * f.overtime_per_min);
}

/* ---------- Classement des offres ---------- */
export function rankOffers(offers, cfg) {
  const w = cfg.offers_policy.ranking_weights;
  const prices = offers.map((o) => o.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const score = (o) => {
    const p = hi === lo ? 1 : (hi - o.price) / (hi - lo);
    const r = (o.rating || 0) / 5;
    const t = o.onTime ? 1 : 0;
    return w.price * p + w.rating * r + w.on_time * t;
  };
  return offers.map((o) => ({ ...o, score: r2(score(o)) })).sort((a, b) => b.score - a.score);
}
