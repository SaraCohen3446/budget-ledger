window.storage = {
  get: async (key) => {
    const value = localStorage.getItem(key);
    return value !== null ? { key, value, shared: false } : null;
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return { key, value, shared: false };
  },
  delete: async (key) => {
    localStorage.removeItem(key);
    return { key, deleted: true, shared: false };
  },
  list: async (prefix) => {
    const keys = Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};

const { useState, useEffect, useMemo, useCallback } = React;

function getMonthFormatter(locale) {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
}

function getBrowserLanguage() {
  const navLocale = (navigator && navigator.language) || "en-US";
  return navLocale.toLowerCase().startsWith("he") ? "he" : "en";
}

function getCurrencySymbol(locale) {
  const currency = locale.startsWith("he") ? "ILS" : "USD";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).formatToParts(0).find((part) => part.type === "currency")?.value || (locale.startsWith("he") ? "₪" : "$");
}

const QUICK_CATEGORIES = {
  he: [
    { name: "דירה", subs: ["שכירות", "ארנונה", "ועד בית", "חשמל", "מים", "גז"] },
    { name: "רכב", subs: ["דלק", "ביטוח", "טסט", "חניה", "תיקונים"] },
    { name: "בגדים", subs: [] },
    { name: "מזון", subs: ["סופר", "מסעדה", "משלוחים", "בית קפה"] },
    { name: "תחבורה", subs: ["אוטובוס", "רכבת", "מונית"] },
    { name: "בידור", subs: ["קולנוע", "מנויים", "בילויים"] },
    { name: "בריאות", subs: ["רופא", "תרופות", "ביטוח בריאות"] },
    { name: "אחר", subs: [] },
  ],
  en: [
    { name: "Rent", subs: ["Rent", "Property tax", "HOA", "Electricity", "Water", "Gas"] },
    { name: "Car", subs: ["Fuel", "Insurance", "Inspection", "Parking", "Repairs"] },
    { name: "Clothes", subs: [] },
    { name: "Food", subs: ["Groceries", "Restaurant", "Delivery", "Coffee"] },
    { name: "Transport", subs: ["Bus", "Train", "Taxi"] },
    { name: "Entertainment", subs: ["Cinema", "Subscriptions", "Outings"] },
    { name: "Health", subs: ["Doctor", "Medication", "Health insurance"] },
    { name: "Other", subs: [] },
  ],
};

const T = {
  he: {
    dir: "rtl", locale: "he-IL",
    eyebrow: "יומן תקציב חודשי",
    prevMonth: "חודש קודם", nextMonth: "חודש הבא",
    loading: "טוען...",
    incomeLabel: "הכנסה עיקרית",
    addIncomeBtn: "+ הוספת הכנסה",
    incomeSourcePlaceholder: "תיאור ההכנסה (למשל: פרילנס)",
    removeIncome: "הסרה",
    quickAddLabel: "הוספה מהירה",
    quickAddName: "שם ההוצאה",
    quickAddAmount: "סכום",
    quickAddBtn: "הוספה",
    notesLabel: "או הדביקו כאן את הפתק מהאייפון",
    notesPlaceholder: "# שכירות\nשכירות - 3500\n\n# מזון\nסופר - 250\nמסעדה - 120",
    malformed: (n) => `${n} שורות לא זוהו — ודאו פורמט "שם - סכום"`,
    breakdown: "פירוט לפי קטגוריה",
    income: "הכנסה",
    totalExpenses: 'סה"כ הוצאות',
    remaining: "נותר",
    saveBtn: "שמירת החודש",
    saved: "נשמר ✓",
    saveFailed: "שמירה נכשלה",
    storageWarn: "השמירה לא זמינה כרגע — הנתונים עדיין מוצגים אך לא יישמרו.",
    defaultCategory: "כללי",
  },
  en: {
    dir: "ltr", locale: "en-US",
    eyebrow: "Monthly Budget Ledger",
    prevMonth: "Previous month", nextMonth: "Next month",
    loading: "Loading...",
    incomeLabel: "Main income",
    addIncomeBtn: "+ Add income",
    incomeSourcePlaceholder: "Income source (e.g. Freelance)",
    removeIncome: "Remove",
    quickAddLabel: "Quick add",
    quickAddName: "Expense name",
    quickAddAmount: "Amount",
    quickAddBtn: "Add",
    notesLabel: "Or paste your note from iPhone here",
    notesPlaceholder: "# Rent\nRent - 3500\n\n# Food\nGroceries - 250\nRestaurant - 120",
    malformed: (n) => `${n} line(s) not recognized — use the format "name - amount"`,
    breakdown: "Breakdown by category",
    income: "Income",
    totalExpenses: "Total expenses",
    remaining: "Remaining",
    saveBtn: "Save this month",
    saved: "Saved ✓",
    saveFailed: "Save failed",
    storageWarn: "Saving isn't available right now — data is shown but won't persist.",
    defaultCategory: "General",
  },
};

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key, lang) {
  const [y, m] = key.split("-").map(Number);
  const locale = lang === "he" ? "he-IL" : "en-US";
  return getMonthFormatter(locale).format(new Date(y, m - 1, 1));
}
function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}
function fmt(n, locale) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(n));
}
function toNumber(value) {
  return parseFloat(String(value).replace(/,/g, "")) || 0;
}

function parseExpenses(text, defaultCategory) {
  const lines = text.split("\n");
  let currentCategory = defaultCategory;
  const categories = {};
  let malformed = 0;

  const ensureCategory = (name) => {
    if (!categories[name]) categories[name] = { total: 0, items: [] };
    return categories[name];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#")) {
      currentCategory = line.replace(/^#+/, "").trim() || defaultCategory;
      ensureCategory(currentCategory);
      continue;
    }

    const match = line.match(/^(.+?)[\s]*[-–:][\s]*([\d,.]+)\s*(?:ש"?ח|₪|\$)?$/);
    if (match) {
      const name = match[1].trim();
      const amount = parseFloat(match[2].replace(/,/g, ""));
      if (!isNaN(amount)) {
        const category = ensureCategory(currentCategory);
        category.items.push({ name, amount });
        category.total += amount;
        continue;
      }
    }
    malformed++;
  }

  const total = Object.values(categories).reduce((sum, c) => sum + c.total, 0);
  return { categories, total, malformed };
}

function makeRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const STORAGE_KEYS = {
  lang: "ledger:lang",
  index: "ledger:index",
  month: (m) => `ledger:${m}`,
};

async function loadLanguage() {
  try {
    const res = await window.storage.get(STORAGE_KEYS.lang);
    return res && res.value && T[res.value] ? res.value : null;
  } catch { return null; }
}
async function saveLanguage(lang) {
  try { await window.storage.set(STORAGE_KEYS.lang, lang); } catch {}
}
async function loadMonthsIndex() {
  try {
    const res = await window.storage.get(STORAGE_KEYS.index);
    const list = res && res.value ? JSON.parse(res.value) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
async function saveMonthsIndex(list) {
  try { await window.storage.set(STORAGE_KEYS.index, JSON.stringify(list)); } catch {}
}
async function loadMonthData(monthId) {
  try {
    const res = await window.storage.get(STORAGE_KEYS.month(monthId));
    return res && res.value ? JSON.parse(res.value) : null;
  } catch { return null; }
}
async function saveMonthData(monthId, data) {
  const result = await window.storage.set(STORAGE_KEYS.month(monthId), JSON.stringify(data));
  if (!result) throw new Error("Storage write failed");
  return result;
}

function BudgetLedger() {
  const [lang, setLang] = useState(getBrowserLanguage());
  const [monthsList, setMonthsList] = useState([monthKey(new Date())]);
  const [activeMonth, setActiveMonth] = useState(monthKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [storageOk, setStorageOk] = useState(true);

  const [income, setIncome] = useState("");
  const [extraIncomes, setExtraIncomes] = useState([]);
  const [notesText, setNotesText] = useState("");

  const [quickCategory, setQuickCategory] = useState(null);
  const [quickSub, setQuickSub] = useState(null);
  const [quickName, setQuickName] = useState("");
  const [quickAmount, setQuickAmount] = useState("");

  const t = T[lang] || T.he;
  const currencySymbol = getCurrencySymbol(t.locale);

  useEffect(() => {
    (async () => {
      const savedLang = await loadLanguage();
      if (savedLang) {
        setLang(savedLang);
      } else {
        setLang(getBrowserLanguage());
      }
      const index = await loadMonthsIndex();
      const initial = index.length ? Array.from(new Set([...index, monthKey(new Date())])).sort() : [monthKey(new Date())];
      setMonthsList(initial);
      await loadMonthIntoState(activeMonth);
    })();
  }, []);

  useEffect(() => {
    loadMonthIntoState(activeMonth);
  }, [activeMonth]);

  const loadMonthIntoState = useCallback(async (monthId) => {
    setLoading(true);
    const data = await loadMonthData(monthId);
    if (data) {
      setIncome(data.income != null ? String(data.income) : "");
      setExtraIncomes(Array.isArray(data.extraIncomes) ? data.extraIncomes : []);
      setNotesText(data.notesText || "");
      setStorageOk(true);
    } else {
      setIncome("");
      setExtraIncomes([]);
      setNotesText("");
    }
    setLoading(false);
  }, []);

  const changeLang = async (newLang) => {
    setLang(newLang);
    await saveLanguage(newLang);
  };

  const parsed = useMemo(() => parseExpenses(notesText, t.defaultCategory), [notesText, t.defaultCategory]);
  const incomeNum = toNumber(income);
  const extraIncomeTotal = useMemo(
    () => extraIncomes.reduce((sum, row) => sum + toNumber(row.amount), 0),
    [extraIncomes]
  );
  const totalIncome = incomeNum + extraIncomeTotal;
  const remaining = totalIncome - parsed.total;
  const overBudget = totalIncome > 0 && remaining < 0;
  const categoryEntries = useMemo(
    () => Object.entries(parsed.categories).sort((a, b) => b[1].total - a[1].total),
    [parsed.categories]
  );

  const addIncomeRow = () => {
    setExtraIncomes((prev) => [...prev, { id: makeRowId(), label: "", amount: "" }]);
  };
  const updateIncomeRow = (id, field, value) => {
    setExtraIncomes((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };
  const removeIncomeRow = (id) => {
    setExtraIncomes((prev) => prev.filter((row) => row.id !== id));
  };

  const goToMonth = (delta) => {
    setActiveMonth((m) => shiftMonth(m, delta));
  };

  const handleSelectCategory = (catName) => {
    setQuickCategory(catName);
    setQuickSub(null);
  };
  const handleSelectSub = (subName) => {
    setQuickSub(subName);
    setQuickName(subName);
  };

  const handleQuickAdd = () => {
    const name = quickName.trim();
    const amount = quickAmount.trim();
    if (!name || !amount || isNaN(parseFloat(amount))) return;

    const category = quickCategory || t.defaultCategory;
    setNotesText((prev) => {
      const trimmedPrev = prev.replace(/\s+$/, "");
      const lines = trimmedPrev.split("\n");
      let lastHeader = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith("#")) {
          lastHeader = lines[i].replace(/^#+/, "").trim();
          break;
        }
      }
      const needsHeader = lastHeader !== category;
      const addition =
        (needsHeader ? `${trimmedPrev ? "\n\n" : ""}# ${category}\n` : "\n") + `${name} - ${amount}`;
      return trimmedPrev + addition;
    });
    setQuickName("");
    setQuickAmount("");
    setQuickSub(null);
  };

  const handleSave = async () => {
    const data = {
      income: incomeNum,
      extraIncomes,
      notesText,
      total: parsed.total,
      remaining,
      categories: Object.fromEntries(Object.entries(parsed.categories).map(([k, v]) => [k, v.total])),
      savedAt: new Date().toISOString(),
    };
    try {
      await saveMonthData(activeMonth, data);
      setStorageOk(true);

      if (!monthsList.includes(activeMonth)) {
        const updatedList = Array.from(new Set([...monthsList, activeMonth])).sort();
        setMonthsList(updatedList);
        await saveMonthsIndex(updatedList);
      }
      setStatus(t.saved);
      setTimeout(() => setStatus(""), 1800);
    } catch {
      setStorageOk(false);
      setStatus(t.saveFailed);
      setTimeout(() => setStatus(""), 2400);
    }
  };

  return (
    <div style={styles.page} dir={t.dir}>
      <style>{fontImport}</style>
      <div style={styles.sheet}>
        <div style={styles.langRow}>
          <button onClick={() => changeLang("he")} style={{ ...styles.langBtn, ...(lang === "he" ? styles.langBtnActive : {}) }}>עברית</button>
          <button onClick={() => changeLang("en")} style={{ ...styles.langBtn, ...(lang === "en" ? styles.langBtnActive : {}) }}>EN</button>
        </div>

        <div style={styles.headerRow}>
          <button style={styles.navBtn} onClick={() => goToMonth(-1)} aria-label={t.prevMonth}>‹</button>
          <div style={styles.headerCenter}>
            <div style={styles.eyebrow}>{t.eyebrow}</div>
            <div style={styles.monthTitle}>{monthLabel(activeMonth, lang)}</div>
          </div>
          <button style={styles.navBtn} onClick={() => goToMonth(1)} aria-label={t.nextMonth}>›</button>
        </div>

        {monthsList.length > 1 && (
          <div style={styles.tabsRow}>
            {monthsList.map((m) => (
              <button key={m} onClick={() => setActiveMonth(m)} style={{ ...styles.tab, ...(m === activeMonth ? styles.tabActive : {}) }}>
                {monthLabel(m, lang).split(" ")[0].slice(0, 3)}
              </button>
            ))}
          </div>
        )}

        <div style={styles.divider} />

        {loading ? (
          <div style={styles.loading}>{t.loading}</div>
        ) : (
          <React.Fragment>
            <div style={styles.fieldBlock}>
              <label style={styles.label}>{t.incomeLabel}</label>
              <div style={styles.incomeRow}>
                <span style={styles.currencyMark}>{currencySymbol}</span>
                <input type="text" inputMode="decimal" value={income}
                  onChange={(e) => setIncome(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="0" style={{ ...styles.incomeInput, textAlign: t.dir === "rtl" ? "right" : "left" }} />
              </div>

              {extraIncomes.map((row) => (
                <div key={row.id} style={styles.extraIncomeRow}>
                  <input type="text" value={row.label} onChange={(e) => updateIncomeRow(row.id, "label", e.target.value)}
                    placeholder={t.incomeSourcePlaceholder} style={styles.extraIncomeName} />
                  <input type="text" inputMode="decimal" value={row.amount}
                    onChange={(e) => updateIncomeRow(row.id, "amount", e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder="0" style={styles.extraIncomeAmount} />
                  <button onClick={() => removeIncomeRow(row.id)} style={styles.extraIncomeRemove} aria-label={t.removeIncome}>×</button>
                </div>
              ))}

              <button style={styles.addIncomeBtn} onClick={addIncomeRow}>{t.addIncomeBtn}</button>
            </div>

            <div style={styles.fieldBlock}>
              <label style={styles.label}>{t.quickAddLabel}</label>
              <div style={styles.chipsRow}>
                {QUICK_CATEGORIES[lang].map((cat) => (
                  <button key={cat.name} onClick={() => handleSelectCategory(cat.name)}
                    style={{ ...styles.chip, ...(quickCategory === cat.name ? styles.chipActive : {}) }}>
                    {cat.name}
                  </button>
                ))}
              </div>

              {quickCategory && QUICK_CATEGORIES[lang].find((c) => c.name === quickCategory)?.subs.length > 0 && (
                <div style={styles.subChipsRow}>
                  {QUICK_CATEGORIES[lang].find((c) => c.name === quickCategory).subs.map((sub) => (
                    <button key={sub} onClick={() => handleSelectSub(sub)}
                      style={{ ...styles.subChip, ...(quickSub === sub ? styles.subChipActive : {}) }}>
                      {sub}
                    </button>
                  ))}
                </div>
              )}

              <div style={styles.quickAddRow}>
                <input type="text" value={quickName} onChange={(e) => setQuickName(e.target.value)}
                  placeholder={t.quickAddName} style={styles.quickInputName} />
                <input type="text" inputMode="decimal" value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder={t.quickAddAmount} style={styles.quickInputAmount} />
                <button style={styles.quickAddBtn} onClick={handleQuickAdd}>{t.quickAddBtn}</button>
              </div>
            </div>

            <div style={styles.fieldBlock}>
              <label style={styles.label}>{t.notesLabel}</label>
              <textarea value={notesText} onChange={(e) => setNotesText(e.target.value)}
                placeholder={t.notesPlaceholder} style={styles.textarea} rows={7} />
              {parsed.malformed > 0 && <div style={styles.warnNote}>{t.malformed(parsed.malformed)}</div>}
            </div>

            <div style={styles.divider} />

            {categoryEntries.length > 0 && (
              <div style={styles.ledgerBlock}>
                <div style={styles.ledgerHeading}>{t.breakdown}</div>
                {categoryEntries.map(([cat, data]) => (
                  <div key={cat} style={styles.ledgerLine}>
                    <span style={styles.ledgerCat}>{cat}</span>
                    <span style={styles.dots} />
                    <span style={styles.ledgerAmt}>{fmt(data.total, t.locale)} {currencySymbol}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.summaryBlock}>
              <div style={styles.summaryRow}>
                <span>{t.income}</span>
                <span style={styles.mono}>{fmt(totalIncome, t.locale)} {currencySymbol}</span>
              </div>
              <div style={styles.summaryRow}>
                <span>{t.totalExpenses}</span>
                <span style={styles.mono}>{fmt(parsed.total, t.locale)} {currencySymbol}</span>
              </div>
              <div style={{ ...styles.remainingBox, ...(overBudget ? styles.remainingBoxNegative : styles.remainingBoxPositive) }}>
                <span>{t.remaining}</span>
                <span style={styles.remainingAmt}>{fmt(remaining, t.locale)} {currencySymbol}</span>
              </div>
            </div>

            <div style={styles.footerRow}>
              <button style={styles.saveBtn} onClick={handleSave}>{t.saveBtn}</button>
              {status && (
                <span style={{ ...styles.status, color: status === t.saveFailed ? "#B5484D" : "#5C7A5E" }}>{status}</span>
              )}
            </div>
            {!storageOk && <div style={styles.warnNote}>{t.storageWarn}</div>}

            <div style={styles.footerCredit}>by SaraCohen</div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Heebo:wght@300;400;500;700&family=JetBrains+Mono:wght@400;600&display=swap');
`;

const paper = "#F7F2E7";
const ink = "#233047";
const inkSoft = "#5B6478";
const gold = "#A8823F";
const sage = "#6E8B6E";
const rust = "#B0503F";
const rule = "#D9CFB8";

const styles = {
  page: { minHeight: "100vh", background: paper, display: "flex", justifyContent: "center", padding: "24px 12px", fontFamily: "'Heebo', system-ui, sans-serif", color: ink, boxSizing: "border-box" },
  sheet: { width: "100%", maxWidth: 480, background: "#FFFDF7", border: `1px solid ${rule}`, borderRadius: 4, boxShadow: "0 2px 0 " + rule + ", 0 12px 28px rgba(35,48,71,0.08)", padding: "20px 26px 24px", boxSizing: "border-box" },
  langRow: { display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 10 },
  langBtn: { fontSize: 11, padding: "3px 9px", borderRadius: 10, border: `1px solid ${rule}`, background: "transparent", color: inkSoft, cursor: "pointer", fontFamily: "'Heebo', sans-serif" },
  langBtnActive: { background: gold, color: "#FFFDF7", borderColor: gold },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerCenter: { textAlign: "center", flex: 1 },
  eyebrow: { fontSize: 11, letterSpacing: "0.14em", color: gold, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 },
  monthTitle: { fontFamily: "'Frank Ruhl Libre', serif", fontSize: 26, fontWeight: 700, color: ink },
  navBtn: { background: "none", border: `1px solid ${rule}`, borderRadius: "50%", width: 32, height: 32, fontSize: 18, color: inkSoft, cursor: "pointer", lineHeight: 1 },
  tabsRow: { display: "flex", gap: 6, justifyContent: "center", marginTop: 10, flexWrap: "wrap" },
  tab: { fontSize: 12, padding: "4px 10px", borderRadius: 12, border: `1px solid ${rule}`, background: "transparent", color: inkSoft, cursor: "pointer" },
  tabActive: { background: ink, color: paper, borderColor: ink },
  divider: { height: 1, background: rule, margin: "18px 0" },
  loading: { textAlign: "center", padding: "40px 0", color: inkSoft },
  fieldBlock: { marginBottom: 18 },
  label: { display: "block", fontSize: 13, color: inkSoft, marginBottom: 8, fontWeight: 500 },
  incomeRow: { display: "flex", alignItems: "baseline", gap: 8, borderBottom: `2px solid ${ink}`, paddingBottom: 6 },
  currencyMark: { fontFamily: "'JetBrains Mono', monospace", fontSize: 20, color: gold },
  incomeInput: { flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 600, color: ink },
  extraIncomeRow: { display: "flex", gap: 8, marginTop: 8 },
  extraIncomeName: { flex: 2, border: `1px solid ${rule}`, borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "'Heebo', sans-serif", background: "#FCFAF3", outline: "none", color: ink, minWidth: 0 },
  extraIncomeAmount: { flex: 1, border: `1px solid ${rule}`, borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", background: "#FCFAF3", outline: "none", color: ink, minWidth: 0 },
  extraIncomeRemove: { background: "transparent", border: `1px solid ${rule}`, borderRadius: 6, width: 32, color: rust, fontSize: 16, cursor: "pointer", lineHeight: 1 },
  addIncomeBtn: { marginTop: 10, background: "transparent", border: `1px dashed ${gold}`, borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: gold, cursor: "pointer", fontFamily: "'Heebo', sans-serif" },
  chipsRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: { fontSize: 12, padding: "5px 12px", borderRadius: 14, border: `1px solid ${rule}`, background: "#FCFAF3", color: inkSoft, cursor: "pointer", fontFamily: "'Heebo', sans-serif" },
  chipActive: { background: sage, color: "#FFFDF7", borderColor: sage },
  subChipsRow: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10, paddingInlineStart: 10, borderInlineStart: `2px solid ${rule}` },
  subChip: { fontSize: 11, padding: "4px 10px", borderRadius: 12, border: `1px solid ${rule}`, background: "transparent", color: gold, cursor: "pointer", fontFamily: "'Heebo', sans-serif" },
  subChipActive: { background: gold, color: "#FFFDF7", borderColor: gold },
  quickAddRow: { display: "flex", gap: 8 },
  quickInputName: { flex: 2, border: `1px solid ${rule}`, borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "'Heebo', sans-serif", background: "#FCFAF3", outline: "none", color: ink, minWidth: 0 },
  quickInputAmount: { flex: 1, border: `1px solid ${rule}`, borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", background: "#FCFAF3", outline: "none", color: ink, minWidth: 0 },
  quickAddBtn: { background: gold, color: "#FFFDF7", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Heebo', sans-serif", whiteSpace: "nowrap" },
  textarea: { width: "100%", border: `1px solid ${rule}`, borderRadius: 6, padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.7, color: ink, background: "#FCFAF3", resize: "vertical", boxSizing: "border-box", outline: "none" },
  warnNote: { fontSize: 12, color: rust, marginTop: 6 },
  ledgerBlock: { marginBottom: 18 },
  ledgerHeading: { fontSize: 12, letterSpacing: "0.08em", color: inkSoft, textTransform: "uppercase", marginBottom: 10, fontWeight: 600 },
  ledgerLine: { display: "flex", alignItems: "baseline", fontSize: 14, padding: "4px 0" },
  ledgerCat: { color: ink, fontWeight: 500, whiteSpace: "nowrap" },
  dots: { flex: 1, margin: "0 8px", borderBottom: `1px dotted ${rule}`, position: "relative", top: -3 },
  ledgerAmt: { fontFamily: "'JetBrains Mono', monospace", color: inkSoft, fontWeight: 600, whiteSpace: "nowrap" },
  summaryBlock: { background: "#F1EADA", borderRadius: 8, padding: "16px 18px" },
  summaryRow: { display: "flex", justifyContent: "space-between", fontSize: 14, color: inkSoft, padding: "5px 0" },
  mono: { fontFamily: "'JetBrains Mono', monospace", color: ink, fontWeight: 600 },
  remainingBox: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 12, borderTop: `1px solid ${rule}`, fontSize: 15, fontWeight: 700 },
  remainingBoxPositive: { color: sage },
  remainingBoxNegative: { color: rust },
  remainingAmt: { fontFamily: "'JetBrains Mono', monospace", fontSize: 22 },
  footerRow: { display: "flex", alignItems: "center", gap: 14, marginTop: 20 },
  saveBtn: { background: ink, color: paper, border: "none", borderRadius: 6, padding: "11px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Heebo', sans-serif" },
  status: { fontSize: 13, fontWeight: 500 },
  footerCredit: { textAlign: "center", marginTop: 24, fontSize: 11, color: rule, letterSpacing: "0.05em" },
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<BudgetLedger />);
