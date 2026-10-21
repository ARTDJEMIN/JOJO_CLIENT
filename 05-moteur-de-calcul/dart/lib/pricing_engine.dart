// Moteur de calcul Jojo — portage Dart de js/pricing-engine.mjs.
// Fonction pure pilotée par pricing-config.json. À exécuter côté backend (Dart Frog, Serverpod…)
// ou côté app pour un aperçu hors ligne ; la référence reste le calcul serveur.
//
// NB : ce portage n'a pas été compilé dans l'environnement de génération (pas de SDK Dart).
// Les tests de test/pricing_engine_test.dart reprennent les cas validés en JavaScript.

import 'dart:math' as math;

double _r2(num x) => (x * 100).round() / 100;

class PricingError implements Exception {
  final String code;
  final String message;
  PricingError(this.code, this.message);
  @override
  String toString() => 'PricingError($code): $message';
}

class AddressAccess {
  final int floor;
  final bool lift;
  final double carryM;
  final double? handlingHours;
  final bool personPerLanding;
  final int bulkyItems;
  const AddressAccess({this.floor = 0, this.lift = false, this.carryM = 0, this.handlingHours, this.personPerLanding = false, this.bulkyItems = 0});
}

class Item {
  final double volumeM3;
  final int qty;
  const Item(this.volumeM3, this.qty);
}

class EstimateInput {
  final String service; // transport | demenagement | gros_bras
  final String? truck; // NONE | T12 | T20 (sinon choisi par le moteur)
  final int? helpers;
  final int grosBrasCount;
  final double distanceKm;
  final double travelMinutes;
  final List<Item> items;
  final double? volumeM3;
  final double? surfaceM2;
  final String? homeType;
  final List<AddressAccess> addresses;
  final List<int> stopoverMinutes;
  final int extraHours;
  final int? chosenHours;
  final double? estimatedHoursOverride;
  final String? startAt; // ISO local, ex. 2026-10-24T22:00
  final bool heavyItem;
  final int specialItems;
  final String channel; // app | web | phone

  const EstimateInput({
    required this.service,
    this.truck,
    this.helpers,
    this.grosBrasCount = 1,
    this.distanceKm = 0,
    this.travelMinutes = 0,
    this.items = const [],
    this.volumeM3,
    this.surfaceM2,
    this.homeType,
    this.addresses = const [],
    this.stopoverMinutes = const [],
    this.extraHours = 0,
    this.chosenHours,
    this.estimatedHoursOverride,
    this.startAt,
    this.heavyItem = false,
    this.specialItems = 0,
    this.channel = 'app',
  });
}

class PriceLine {
  final String code;
  final String label;
  final double amount;
  const PriceLine(this.code, this.label, this.amount);
}

class Estimate {
  final bool quoteRequired;
  final String? formula;
  final String? truck;
  final int helpers;
  final double volume;
  final double estimatedHours;
  final int hours;
  final int onSiteHours;
  final int kmIncluded;
  final double overtimePerMin;
  final List<PriceLine> lines;
  final double total;
  final List<String> alerts;
  final String configVersion;
  const Estimate({
    required this.quoteRequired,
    this.formula,
    this.truck,
    this.helpers = 0,
    this.volume = 0,
    this.estimatedHours = 0,
    this.hours = 0,
    this.onSiteHours = 0,
    this.kmIncluded = 0,
    this.overtimePerMin = 0,
    this.lines = const [],
    this.total = 0,
    this.alerts = const [],
    required this.configVersion,
  });
}

class PricingEngine {
  final Map<String, dynamic> cfg;
  PricingEngine(this.cfg);

  List<Map<String, dynamic>> get _formulas => (cfg['formulas'] as List).cast<Map<String, dynamic>>();
  Map<String, dynamic> _m(String k) => (cfg[k] as Map).cast<String, dynamic>();

  double computeVolume(EstimateInput i) {
    final vp = _m('volume_policy');
    if (i.items.isNotEmpty && vp['list_overrides_surface'] == true) {
      return i.items.fold(0.0, (s, it) => s + it.volumeM3 * it.qty);
    }
    if (i.volumeM3 != null) return i.volumeM3!;
    num? surface = i.surfaceM2;
    if (surface == null && i.homeType != null) surface = (vp['home_type_surfaces_m2'] as Map)[i.homeType];
    if (surface == null) return 0;
    return (surface * (vp['surface_height_m'] as num) / (vp['surface_divisor'] as num)).toDouble();
  }

  String? chooseTruck(String service, double volume) {
    if (service == 'gros_bras') return 'NONE';
    if (volume > (_m('volume_policy')['quote_above_m3'] as num)) return null;
    final trucks = (cfg['trucks'] as List).cast<Map<String, dynamic>>().where((t) => (t['capacity_m3'] as num) > 0).toList()
      ..sort((a, b) => (a['capacity_m3'] as num).compareTo(b['capacity_m3'] as num));
    for (final t in trucks) {
      if (volume <= (t['capacity_m3'] as num)) return t['code'] as String;
    }
    return null;
  }

  Map<String, dynamic> selectFormula(String truck, int helpers) {
    final row = ((_m('selection_matrix')[truck] ?? {}) as Map).cast<String, dynamic>();
    final code = row['$helpers'];
    if (code == null) {
      throw PricingError('formula_unavailable', 'Aucune formule pour $truck avec $helpers Gros Bras (possibles : ${row.keys.join(', ')})');
    }
    return _formulas.firstWhere((f) => f['code'] == code);
  }

  double estimateDuration(EstimateInput i, Map<String, dynamic> f, double volume) {
    final dm = _m('duration_modifiers');
    final n = f['helpers'] as int;
    final travelH = i.travelMinutes / 60;
    final truck = (cfg['trucks'] as List).cast<Map<String, dynamic>>().firstWhere((t) => t['code'] == f['truck']);
    final cap = (truck['capacity_m3'] as num).toDouble();
    final fill = cap > 0 ? volume / cap : 0.0;
    final ftm = (dm['full_truck_minimum'] as Map);
    final fullTruck = i.service == 'demenagement' || fill >= (ftm['fill_ratio'] as num);
    final perSide = fullTruck ? ((ftm['per_side_hours'] as Map)[f['truck']] as num?)?.toDouble() ?? 0.0 : 0.0;
    final ignoreAccess = n == 0 && dm['self_loading_ignores_access'] == true;
    final fl = dm['floor_no_lift'] as Map;
    final cd = dm['carry_distance'] as Map;
    final tf = dm['three_floors_total_no_lift'] as Map;

    var handling = 0.0;
    var floorsNoLift = 0;
    for (final a in i.addresses) {
      var base = (a.handlingHours ?? 0).toDouble();
      if (perSide > 0) base = math.max(base, perSide);
      var pct = 0.0;
      if (!ignoreAccess) {
        if (!a.lift && a.floor > 0) floorsNoLift += a.floor;
        final from = fl['from_floor'] as int;
        if (!a.lift && a.floor >= from && !(a.personPerLanding && fl['cancelled_by_person_per_landing'] == true)) {
          pct += (a.floor - (from - 1)) * (fl['pct_per_floor'] as num);
        }
        final step = (cd['step_m'] as num).toDouble();
        final steps = cd['count_started_step'] == true ? (a.carryM / step).ceil() : (a.carryM / step).floor();
        pct += steps * (cd['pct_per_step'] as num);
      }
      handling += base * (1 + pct / 100);
    }
    final stairs = (!ignoreAccess && floorsNoLift >= (tf['threshold_floors'] as int)) ? (tf['fixed_hours'] as num).toDouble() : 0.0;
    final stop = i.stopoverMinutes.fold(0, (s, m) => s + m) / 60;
    return travelH + handling + stairs + stop;
  }

  Map<String, int> _hoursPerSlotMinutes(String? startAt, int hours) {
    final out = <String, int>{};
    if (startAt == null) return out;
    final m = RegExp(r'T(\d{2}):(\d{2})').firstMatch(startAt);
    if (m == null) return out;
    var t = int.parse(m.group(1)!) * 60 + int.parse(m.group(2)!);
    int mod(String hhmm) { final p = hhmm.split(':'); return int.parse(p[0]) * 60 + int.parse(p[1]); }
    final slots = ((_m('price_modifiers')['time_slots']) as List).cast<Map<String, dynamic>>();
    for (var k = 0; k < hours * 60; k++) {
      for (final s in slots) {
        final a = mod(s['from']), b = mod(s['to']);
        final inside = a < b ? (t >= a && t < b) : (t >= a || t < b);
        if (inside) out[s['code']] = (out[s['code']] ?? 0) + 1;
      }
      t = (t + 1) % 1440;
    }
    return out;
  }

  Estimate estimate(EstimateInput i) {
    final alerts = <String>[];
    final lines = <PriceLine>[];
    final volume = computeVolume(i);
    final truck = i.truck ?? chooseTruck(i.service, volume);
    if (truck == null) {
      return Estimate(quoteRequired: true, volume: volume, configVersion: cfg['version'], alerts: ['Volume au-delà de la limite : sortie en devis.']);
    }
    final helpers = i.helpers ?? (truck == 'NONE' ? 1 : 0);
    final f = selectFormula(truck, helpers);
    final estH = i.estimatedHoursOverride ?? estimateDuration(i, f, volume);

    final minH = f['min_hours'] as int, maxH = f['max_hours'] as int;
    final maxExtra = _m('duration_policy')['max_extra_hours_over_estimate'] as int;
    final est = math.max(minH, (estH - 1e-9).ceil());
    final extra = math.min(math.max(i.extraHours, 0), maxExtra);
    var hours = i.chosenHours ?? est + extra;
    final maxAllowed = math.min(maxH, est + maxExtra);
    hours = math.min(math.max(hours, minH), math.max(maxAllowed, minH));
    if (hours < math.min(est, maxH)) alerts.add('Durée réservée inférieure à la durée estimée : risque de dépassement.');

    final tiers = (f['tiers'] as List).cast<Map<String, dynamic>>();
    final tier = tiers.firstWhere((t) => t['hours'] == hours, orElse: () => throw PricingError('tier_missing', 'Pas de palier $hours h pour ${f['code']}'));

    final lp = _m('labor');
    final pm = _m('price_modifiers');
    final isGB = f['truck'] == 'NONE';
    final crew = isGB ? i.grosBrasCount : f['helpers'] as int;
    final heavyMul = (pm['gros_bras_heavy_multiplier'] as num).toDouble();

    var base = (tier['price'] as num).toDouble();
    if (isGB && pm['gros_bras_price_per_helper'] == true) base *= crew;
    lines.add(PriceLine('BASE', '${f['label']} · ${isGB ? '$crew × ' : ''}$hours h', _r2(base)));

    if (i.heavyItem) {
      if (isGB) {
        lines.add(PriceLine('HEAVY', 'Charge lourde', _r2(base * (heavyMul - 1))));
      } else if (crew > 0) {
        lines.add(PriceLine('HEAVY', 'Charge lourde', _r2(((lp['heavy_item_hourly_rate'] as num) - (lp['hourly_rate'] as num)) * crew * hours)));
      }
    }
    if (i.specialItems > 0) {
      final persons = crew + (isGB ? 0 : 1);
      lines.add(PriceLine('SPECIAL', 'Objet spécifique', _r2((lp['special_item_hourly_rate_per_person'] as num) * persons * hours)));
    }

    final extraKm = math.max(0.0, i.distanceKm - (tier['km_included'] as num));
    if (extraKm > 0) {
      final rate = f['extra_km_rate'] as num?;
      if (rate == null) {
        alerts.add('Tarif au km non défini pour ${f['label']}.');
      } else {
        lines.add(PriceLine('EXTRA_KM', 'Kilomètres au-delà de l\'inclus', _r2(extraKm * rate)));
      }
    }

    final slotMin = _hoursPerSlotMinutes(i.startAt, hours);
    final laborPerHour = isGB ? base * (i.heavyItem ? heavyMul : 1) / hours
        : crew * ((i.heavyItem ? lp['heavy_item_hourly_rate'] : lp['hourly_rate']) as num).toDouble();
    for (final s in (pm['time_slots'] as List).cast<Map<String, dynamic>>()) {
      final h = (slotMin[s['code']] ?? 0) / 60;
      if (h > 0 && laborPerHour > 0) {
        lines.add(PriceLine('SLOT_${s['code']}', 'Majoration ${s['from']}–${s['to']}', _r2(laborPerHour * h * (s['pct_on_labor'] as num) / 100)));
      }
    }
    for (final a in i.addresses) {
      if (!a.lift && a.floor >= 3 && a.bulkyItems > 0) {
        lines.add(PriceLine('BULKY_FLOOR3', 'Objets volumineux', _r2(a.bulkyItems * ((pm['bulky_item_floor3_no_lift'] as Map)['eur_per_item_per_address'] as num))));
      }
    }
    if (i.channel == 'phone') lines.add(PriceLine('PHONE_FEE', 'Frais de dossier', (pm['phone_booking_fee'] as num).toDouble()));

    final total = _r2(lines.fold(0.0, (s, l) => s + l.amount));
    final pause = f['pause'] as Map?;
    final onSite = pause != null && hours >= (pause['from_hours'] as int) ? hours + (pause['hours'] as int) : hours;

    return Estimate(
      quoteRequired: false,
      formula: f['code'],
      truck: truck,
      helpers: crew,
      volume: _r2(volume),
      estimatedHours: _r2(estH),
      hours: hours,
      onSiteHours: onSite,
      kmIncluded: tier['km_included'] as int,
      overtimePerMin: (f['overtime_per_min'] as num).toDouble(),
      lines: lines,
      total: total,
      alerts: alerts,
      configVersion: cfg['version'],
    );
  }
}
