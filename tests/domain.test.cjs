const test = require('node:test');
const assert = require('node:assert/strict');
const { projectMetrics, rub, SERVICE_LABELS, SOURCE_LABELS } = require('../src/domain.cjs');

test('project metrics keep contract debt separate from cash after paid expenses', () => {
  assert.deepEqual(projectMetrics(150000, 100000, 0, 35000, 35000), {
    debtRub: 50000,
    cashAfterPaidExpensesRub: 65000,
    estimatedProfitRub: 115000,
    receivedRub: 100000,
    paidExpensesRub: 35000
  });
});
test('refunds reduce net receipts and may not create negative client debt', () => {
  const result = projectMetrics(10000, 5000, 2000, 1000, 4000);
  assert.equal(result.receivedRub, 3000);
  assert.equal(result.debtRub, 7000);
  assert.equal(result.cashAfterPaidExpensesRub, 2000);
  assert.equal(result.estimatedProfitRub, 6000);
});
test('invalid negative amounts are rejected', () => {
  assert.throws(() => projectMetrics(100, -1, 0, 0, 0), RangeError);
  assert.throws(() => projectMetrics(100, 10, 0, 0, -1), RangeError);
});
test('Russian labels exist for the three business services and lead sources', () => {
  assert.equal(SERVICE_LABELS.demolition, 'Демонтаж');
  assert.equal(SERVICE_LABELS.finishing, 'Отделочные работы');
  assert.equal(SERVICE_LABELS.raised_floor, 'Фальшполы');
  assert.equal(SOURCE_LABELS.avito, 'Авито');
  assert.equal(SOURCE_LABELS.recommendation, 'Рекомендация');
});
test('currency formatter does not throw for zero and integer rubles', () => {
  assert.match(rub(0), /0/);
  assert.match(rub(125000), /125/);
});

test('CSV import parses semicolon-separated Russian headers and quoted separators', () => {
  const { parseCsv } = require('../src/csv.cjs');
  const rows = parseCsv('Компания;Город;Телефон;Комментарий\r\n"ООО; Пример";Москва;+79990000000;"Объект, офис"');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].company_name, 'ООО; Пример');
  assert.equal(rows[0].region, 'Москва');
  assert.equal(rows[0].notes, 'Объект, офис');
});
test('CSV import rejects files without a company name column', () => {
  const { parseCsv } = require('../src/csv.cjs');
  assert.throws(() => parseCsv('Телефон;Город\n+79990000000;Москва'), /не найдена колонка/);
});

test('CSV parser detects comma, semicolon and tab delimiters and preserves quoted separators', () => {
  const { parseCsv } = require('../src/csv.cjs');
  const comma = parseCsv('company_name,phone,notes\n"ООО Пример, Москва",+79990000000,"Демонтаж, офис"');
  assert.equal(comma[0].company_name, 'ООО Пример, Москва');
  assert.equal(comma[0].notes, 'Демонтаж, офис');
  const tab = parseCsv('Компания\tТелефон\tГород\nООО Ремонт\t+79991112233\tМосква');
  assert.equal(tab[0].company_name, 'ООО Ремонт');
  assert.equal(tab[0].region, 'Москва');
});

test('CSV parser accepts service and source aliases in Russian', () => {
  const { parseCsv } = require('../src/csv.cjs');
  const rows = parseCsv('Компания;Услуга;Источник данных;Ссылка на источник\nООО Демонтаж;Демонтаж;Telegram;https://t.me/example');
  assert.equal(rows[0].service, 'Демонтаж');
  assert.equal(rows[0].source_name, 'Telegram');
  assert.equal(rows[0].source_url, 'https://t.me/example');
});

test('CSV parser reports malformed quoted cells instead of silently importing corrupt data', () => {
  const { parseCsv } = require('../src/csv.cjs');
  assert.throws(() => parseCsv('Компания;Заметки\nООО Пример;"незакрытая заметка'), /незакрытая кавычка/);
});

test('prospect duplicate detection normalizes phone, URL and company spelling', () => {
  const { prospectDuplicateKeys, normalizePhone, normalizeUrl } = require('../src/csv.cjs');
  assert.equal(normalizePhone('+7 (999) 123-45-67'), '79991234567');
  assert.equal(normalizePhone('8 999 123 45 67'), '79991234567');
  assert.equal(normalizeUrl('https://WWW.Example.ru/?utm_source=telegram#contact'), 'https://example.ru');
  const a = prospectDuplicateKeys({ company_name: 'ООО «РЕМОНТ-СЕРВИС»', region: 'Москва', phone: '+7 (999) 123-45-67' });
  const b = prospectDuplicateKeys({ company_name: 'ООО Ремонт сервис', region: 'Москва', phone: '8 999 123 45 67' });
  assert.ok(a.some(key => b.includes(key)));
});
