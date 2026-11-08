"""Build public/foods.json from USDA FoodData Central SR Legacy (public domain).

Runs in GitHub Actions (see .github/workflows/build-foods.yml). Output rows:
[name, kcal, protein, carbs, fat, servingLabel, servingGrams] per 100 g.
"""
import csv, io, json, re, sys, urllib.request, zipfile

URLS = [
    'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
    'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_%202018-04.zip',
]
NUTRIENTS = {'1008': 'kcal', '1003': 'protein', '1005': 'carbs', '1004': 'fat'}
SKIP_CATEGORIES = {'Baby Foods'}


def fetch():
    for u in URLS:
        try:
            print('downloading', u)
            with urllib.request.urlopen(u, timeout=120) as r:
                return zipfile.ZipFile(io.BytesIO(r.read()))
        except Exception as e:  # try next mirror
            print('  failed:', e)
    sys.exit('could not download SR Legacy')


def table(z, name):
    path = next(n for n in z.namelist() if n.split('/')[-1] == name)
    return csv.DictReader(io.TextIOWrapper(z.open(path), encoding='utf-8'))


def tidy(desc):
    # "Chicken, broilers or fryers, breast, meat only, cooked, roasted" -> sentence case
    d = re.sub(r'\s+', ' ', desc).strip()
    return d[:1].upper() + d[1:].lower() if d.isupper() else d


def main():
    z = fetch()
    cats = {r['id']: r['description'] for r in table(z, 'food_category.csv')}
    foods = {}
    for r in table(z, 'food.csv'):
        if cats.get(r['food_category_id']) in SKIP_CATEGORIES:
            continue
        foods[r['fdc_id']] = {'name': tidy(r['description'])}
    for r in table(z, 'food_nutrient.csv'):
        f = foods.get(r['fdc_id'])
        key = NUTRIENTS.get(r['nutrient_id'])
        if f is not None and key and r['amount']:
            f[key] = float(r['amount'])
    portions = {}
    for r in table(z, 'food_portion.csv'):
        if r['fdc_id'] not in foods or not r['gram_weight']:
            continue
        seq = int(r['seq_num'] or 99)
        if r['fdc_id'] in portions and portions[r['fdc_id']][0] <= seq:
            continue
        amt = r['amount'] or '1'
        amt = amt[:-2] if amt.endswith('.0') else amt
        label = ' '.join(x for x in [amt, r['modifier'] or r['portion_description']] if x).strip()
        portions[r['fdc_id']] = (seq, label, round(float(r['gram_weight'])))
    rows = []
    for fid, f in foods.items():
        if 'kcal' not in f:
            continue
        p = portions.get(fid)
        rows.append([f['name'], round(f['kcal']), round(f.get('protein', 0), 1), round(f.get('carbs', 0), 1), round(f.get('fat', 0), 1),
                     p[1] if p else '', p[2] if p else 0])
    rows.sort(key=lambda r: r[0])
    with open('public/foods.json', 'w') as out:
        json.dump({'source': 'USDA FoodData Central SR Legacy', 'rows': rows}, out, separators=(',', ':'), ensure_ascii=False)
    print(len(rows), 'foods written')


if __name__ == '__main__':
    main()
