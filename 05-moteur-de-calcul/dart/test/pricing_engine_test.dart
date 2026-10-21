// Mêmes cas que js/pricing-engine.test.mjs — lancer : dart test
import 'dart:convert';
import 'dart:io';
import 'package:test/test.dart';
import '../lib/pricing_engine.dart';

void main() {
  final cfg = jsonDecode(File('../../04-configuration/pricing-config.json').readAsStringSync()) as Map<String, dynamic>;
  final engine = PricingEngine(cfg);

  test('exemple A — DemSolo 4 h, 31,7 km = 160 €', () {
    final r = engine.estimate(const EstimateInput(service: 'transport', truck: 'T12', helpers: 0, estimatedHoursOverride: 3.6, distanceKm: 31.7));
    expect(r.hours, 4);
    expect(r.total, 160);
  });

  test('exemple B — Moov 4 h, 45 km = 207,50 €', () {
    final r = engine.estimate(const EstimateInput(service: 'transport', truck: 'T12', helpers: 1, estimatedHoursOverride: 4, distanceKm: 45));
    expect(r.total, 207.5);
  });

  test('exemple C — Cargo+2 de 22 h à 2 h = 452 €', () {
    final r = engine.estimate(const EstimateInput(service: 'transport', truck: 'T20', helpers: 2, estimatedHoursOverride: 4, distanceKm: 38, startAt: '2026-10-24T22:00'));
    expect(r.total, 452);
  });

  test('exemple D — Moov+2 3 h, piano, téléphone = 595 €', () {
    final r = engine.estimate(const EstimateInput(service: 'transport', truck: 'T12', helpers: 2, estimatedHoursOverride: 3, distanceKm: 25, specialItems: 1, channel: 'phone'));
    expect(r.total, 595);
  });

  test('Déménagement Cargo+2 5 h = 470 €, 6 h sur place', () {
    final r = engine.estimate(const EstimateInput(service: 'demenagement', truck: 'T20', helpers: 2, estimatedHoursOverride: 4.75, distanceKm: 31.7));
    expect(r.total, 470);
    expect(r.onSiteHours, 6);
  });

  test('Gros bras 2 × 2 h + charge lourde = 120 €', () {
    final r = engine.estimate(const EstimateInput(service: 'gros_bras', helpers: 1, grosBrasCount: 2, heavyItem: true, estimatedHoursOverride: 2));
    expect(r.total, 120);
  });

  test('combinaison absente refusée', () {
    expect(() => engine.selectFormula('T20', 0), throwsA(isA<PricingError>()));
  });
}
