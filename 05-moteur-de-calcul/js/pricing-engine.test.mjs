// Tests du moteur de calcul — lancer : node --test pricing-engine.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { estimate, selectFormula, cancellationFee, overtimeAmount, rankOffers, computeVolume, PricingError } from './pricing-engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(here, '../../04-configuration/pricing-config.json'), 'utf8'));

const TRUCK_OF = { NONE: 'NONE', T12: 'T12', T20: 'T20' };

test('grille : chaque cellule publiée est restituée à l’identique (52 paliers)', () => {
  let n = 0;
  for (const f of cfg.formulas) {
    for (const t of f.tiers) {
      const r = estimate({ service: f.truck === 'NONE' ? 'gros_bras' : 'transport', truck: TRUCK_OF[f.truck], helpers: f.helpers,
        grosBrasCount: 1, chosenHours: t.hours, estimatedHoursOverride: t.hours, distanceKm: 0 }, cfg);
      assert.equal(r.formula, f.code);
      assert.equal(r.total, t.price, `${f.code} ${t.hours} h`);
      assert.equal(r.kmIncluded, t.km_included);
      n++;
    }
  }
  assert.equal(n, 52);
});

test('matrice : une combinaison absente est refusée', () => {
  assert.throws(() => selectFormula('T20', 0, cfg), PricingError);
  assert.throws(() => selectFormula('T12', 3, cfg), PricingError);
  assert.equal(selectFormula('T20', 2, cfg).code, 'CARGO_2');
});

test('exemple A — parcours Transport de la maquette : DemSolo 4 h, 31,7 km = 160 €', () => {
  const r = estimate({ service: 'transport', truck: 'T12', helpers: 0, estimatedHoursOverride: 3.6, distanceKm: 31.7, startAt: '2026-10-24T09:00' }, cfg);
  assert.equal(r.hours, 4);
  assert.equal(r.total, 160);
});

test('exemple B — km en plus : Moov 4 h, 45 km = 207,50 €', () => {
  const r = estimate({ service: 'transport', truck: 'T12', helpers: 1, estimatedHoursOverride: 4, distanceKm: 45 }, cfg);
  assert.equal(r.total, 207.5);
});

test('exemple C — soirée : Cargo+2 4 h de 22 h à 2 h, 38 km = 452 €', () => {
  const r = estimate({ service: 'transport', truck: 'T20', helpers: 2, estimatedHoursOverride: 4, distanceKm: 38, startAt: '2026-10-24T22:00' }, cfg);
  assert.equal(r.total, 452);
});

test('exemple D — téléphone et piano : Moov+2 3 h, 25 km = 595 €', () => {
  const r = estimate({ service: 'transport', truck: 'T12', helpers: 2, estimatedHoursOverride: 3, distanceKm: 25, specialItems: 1, channel: 'phone' }, cfg);
  assert.equal(r.total, 595);
});

test('Déménagement de la maquette : Cargo+2 5 h, 31,7 km = 470 €, 6 h sur place', () => {
  const r = estimate({ service: 'demenagement', truck: 'T20', helpers: 2, estimatedHoursOverride: 4.75, distanceKm: 31.7 }, cfg);
  assert.equal(r.hours, 5);
  assert.equal(r.total, 470);
  assert.equal(r.onSiteHours, 6);
});

test('Gros bras de la maquette : 2 Gros Bras × 2 h + charge lourde = 120 €', () => {
  const r = estimate({ service: 'gros_bras', helpers: 1, grosBrasCount: 2, heavyItem: true, estimatedHoursOverride: 2, startAt: '2026-10-26T13:00' }, cfg);
  assert.equal(r.total, 120);
  assert.deepEqual(r.lines.map((l) => l.amount), [80, 40]);
});

test('Gros bras capture d’origine : 1 Gros Bras 1 h, objet de 89 kg = 30 €', () => {
  const r = estimate({ service: 'gros_bras', grosBrasCount: 1, heavyItem: true, estimatedHoursOverride: 1 }, cfg);
  assert.equal(r.total, 30);
});

test('durée : étage sans ascenseur, portage et minimum camion plein', () => {
  const f = { service: 'demenagement', truck: 'T20', helpers: 2, distanceKm: 10, travelMinutes: 30,
    addresses: [{ floor: 4, lift: false, carryM: 40, handlingHours: 1 }, { floor: 0, lift: true, carryM: 0, handlingHours: 1 }] };
  const r = estimate(f, cfg);
  // départ : max(1, 1,5) × (1 + 20 % étage + 20 % portage) = 2,1 h ; arrivée : 1,5 h ; trajet 0,5 h ; 4 étages cumulés → + 2 h
  assert.equal(r.estimatedHours, 6.1);
  assert.equal(r.hours, 7);
});

test('client qui charge seul : les accès ne changent pas la durée', () => {
  const r = estimate({ service: 'transport', truck: 'T12', helpers: 0, travelMinutes: 60,
    addresses: [{ floor: 5, lift: false, carryM: 60, handlingHours: 0.5 }] }, cfg);
  assert.equal(r.estimatedHours, 1.5);
  assert.equal(r.hours, 2);
});

test('temps réservé en plus : borné à + 4 h et au palier maximum', () => {
  const r = estimate({ service: 'transport', truck: 'T12', helpers: 1, estimatedHoursOverride: 3, extraHours: 9 }, cfg);
  assert.equal(r.hours, 7);
  const r2 = estimate({ service: 'transport', truck: 'T12', helpers: 1, estimatedHoursOverride: 6, extraHours: 4 }, cfg);
  assert.equal(r2.hours, 8);
});

test('volume : la liste prime sur la surface ; surface × 2 ÷ 4', () => {
  assert.equal(computeVolume({ surfaceM2: 70 }, cfg), 35);
  assert.equal(computeVolume({ homeType: 'T2' }, cfg), 22.5);
  assert.equal(computeVolume({ surfaceM2: 70, items: [{ volumeM3: 1.5, qty: 1 }] }, cfg), 1.5);
});

test('au-delà de 20 m³ : sortie en devis', () => {
  const r = estimate({ service: 'demenagement', surfaceM2: 70 }, cfg);
  assert.equal(r.quoteRequired, true);
});

test('annulation et dépassement', () => {
  assert.equal(cancellationFee('DEMSOLO', 3, false, cfg), 0);
  assert.equal(cancellationFee('DEMSOLO', 1, false, cfg), 25);
  assert.equal(cancellationFee('CARGO_3', 0, true, cfg), 450);
  assert.equal(overtimeAmount('DEMSOLO', 4, 4 * 60 + 30, 15, cfg), 29.05);
});

test('classement des offres : ordre de la maquette', () => {
  const ranked = rankOffers([
    { id: 'julien', price: 160, rating: 4.7, onTime: true },
    { id: 'aicha', price: 145, rating: 4.2, onTime: false },
    { id: 'moussa', price: 150, rating: 4.9, onTime: true }
  ], cfg);
  assert.deepEqual(ranked.map((o) => o.id), ['moussa', 'julien', 'aicha']);
});
