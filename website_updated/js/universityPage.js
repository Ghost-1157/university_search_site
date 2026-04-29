function findValueByNameHints(row, hints) {
  const keys = Object.keys(row || {});
  const matchedKey = keys.find((key) => hints.some((hint) => key.toLowerCase().includes(hint)));
  return matchedKey ? row[matchedKey] ?? "" : "";
}

function getValueByPosition(row, position) {
  return Object.values(row || {})[position] ?? "";
}

function pickValue(row, hints, position) {
  const byName = findValueByNameHints(row, hints);
  if (String(byName).trim() !== "") {
    return byName;
  }
  return getValueByPosition(row, position);
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) return value;
      continue;
    }
    if (String(value).trim() !== "") return value;
  }
  return "";
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04FF]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }
  const parsed = Number.parseFloat(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatMoney(value) {
  const numeric = toNumber(value);
  if (Number.isFinite(numeric)) {
    return `${Math.round(numeric).toLocaleString("ru-RU")} KZT`;
  }
  return "Нет данных";
}

function formatMoneyOrText(value) {
  const numeric = toNumber(value);
  if (Number.isFinite(numeric)) {
    return `${Math.round(numeric).toLocaleString("ru-RU")} KZT`;
  }

  const text = String(value || "").trim();
  return text || "Нет данных";
}

function formatCountOrText(value) {
  const numeric = toNumber(value);
  if (Number.isFinite(numeric)) {
    return String(Math.round(numeric));
  }

  const text = String(value || "").trim();
  return text || "Нет данных";
}

function formatScoreRange(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "Нет данных";
  }

  if (text.includes("-") || text.includes("–")) {
    return text;
  }

  const digitsOnly = text.replace(/\D+/g, "");
  if (digitsOnly.length >= 4) {
    const left = digitsOnly.slice(0, digitsOnly.length - 3);
    const right = digitsOnly.slice(-3);
    return `${left}-${right}`;
  }

  return text;
}

function formatCompetitionText(applicantsValue, grantsValue) {
  const applicants = toNumber(applicantsValue);
  const grants = toNumber(grantsValue);

  if (!Number.isFinite(applicants) || !Number.isFinite(grants) || grants <= 0) {
    return "Нет данных";
  }

  const ratio = applicants / grants;
  return `${ratio.toFixed(1)} заявки на место`;
}

function pickExactColumn(row, columnName) {
  if (!row || typeof row !== "object") {
    return "";
  }

  if (Object.prototype.hasOwnProperty.call(row, columnName)) {
    return row[columnName] ?? "";
  }

  const matchedKey = Object.keys(row).find(
    (key) => String(key).replace(/\s+/g, "") === columnName
  );

  return matchedKey ? row[matchedKey] ?? "" : "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeCorrectedRow(row) {
  const programName = pickValue(row, ["specialty", "faculty", "program", "major", "direction", "col_9"], 8);
  const passScore = pickFirstNonEmpty(
    pickExactColumn(row, "col_14"),
    pickValue(row, ["pass", "ent", "threshold", "min score", "minimum"], 13)
  );
  const grantRaw = pickFirstNonEmpty(
    pickExactColumn(row, "col_15"),
    pickValue(row, ["grant", "grants", "budget"], 14)
  );
  const applicantRaw = pickFirstNonEmpty(
    pickExactColumn(row, "col_16"),
    pickValue(row, ["applicant", "applications", "students", "contest", "konkurs", "competition"], 15)
  );
  const scoreRangeRaw = pickFirstNonEmpty(
    pickExactColumn(row, "col_17"),
    pickValue(row, ["score range", "range", "scores"], 16)
  );
  const transportRaw = pickValue(row, ["transport"], 16);
  const apartmentRaw = pickExactColumn(row, "col_1") || pickValue(row, ["apartment", "flat", "rent"], 17);
  const foodRaw = pickExactColumn(row, "col_18") || pickValue(row, ["food"], 18);
  const dormitoryRaw = pickExactColumn(row, "col_19") || pickValue(row, ["dormitory", "hostel_cost"], 19);
  const leisureRaw = pickExactColumn(row, "col_20") || pickValue(row, ["leisure"], 20);
  const totalRaw = pickExactColumn(row, "col_21") || pickValue(row, ["sum", "total"], 21);

  return {
    name: String(pickValue(row, ["university_name", "university", "name", "title", "col"], 0) || ""),
    city: String(pickValue(row, ["region", "city", "location", "col_2"], 1) || ""),
    type: String(pickValue(row, ["type", "ownership", "status", "col_3"], 2) || ""),
    email: String(pickValue(row, ["email", "mail", "col_4"], 3) || ""),
    phone: String(pickValue(row, ["phone", "contact", "tel", "col_5"], 4) || ""),
    website: String(pickValue(row, ["website", "site", "url", "col_6"], 5) || ""),
    subjectCombination: String(pickValue(row, ["subject", "profile", "col_7"], 6) || ""),
    programCode: String(pickValue(row, ["code", "col_8"], 7) || ""),
    programName: String(programName || "Не указано"),
    passScoreValue: toNumber(passScore),
    passScoreText: Number.isFinite(toNumber(passScore)) ? String(Math.round(toNumber(passScore))) : "Не указано",
    contestValue: applicantRaw,
    contestText: formatCompetitionText(applicantRaw, grantRaw),
    grantValue: grantRaw,
    grantText: formatCountOrText(grantRaw),
    applicantCountValue: applicantRaw,
    applicantCountText: formatCountOrText(applicantRaw),
    scoreRangeValue: scoreRangeRaw,
    scoreRangeText: formatScoreRange(scoreRangeRaw),
    degree: String(pickValue(row, ["degree", "qualification", "level", "col_10"], 9) || ""),
    language: String(pickValue(row, ["language", "lang", "col_11"], 10) || ""),
    duration: String(pickValue(row, ["duration", "term", "length", "col_12"], 11) || ""),
    tuitionRaw: pickValue(row, ["tuition", "price", "cost", "fee", "col_13"], 12),
    transport: transportRaw,
    apartment: apartmentRaw,
    food: foodRaw,
    dormitory: dormitoryRaw,
    leisure: leisureRaw,
    total: totalRaw,
    link: String(pickValue(row, ["link", "url", "col_14"], 13) || ""),
    row
  };
}

function findRowsByUniversity(rows, universityName) {
  const target = normalizeName(universityName);

  return rows.filter((row) => {
    const candidate = normalizeName(row.name);
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
}

function resolveCanonicalUniversityName(rows, universityName) {
  const target = normalizeName(universityName);
  if (!target) {
    return "";
  }

  const exact = rows.find((row) => normalizeName(row.name) === target);
  if (exact) {
    return exact.name;
  }

  const partial = rows.find((row) => {
    const candidate = normalizeName(row.name);
    return candidate.includes(target) || target.includes(candidate);
  });

  return partial ? partial.name : "";
}

function findRowsByCanonicalName(rows, canonicalName) {
  const canonical = normalizeName(canonicalName);
  if (!canonical) {
    return [];
  }

  return rows.filter((row) => normalizeName(row.name) === canonical);
}

function getRequestedUniversityName() {
  const params = new URLSearchParams(window.location.search);
  return params.get("name") || "";
}

function getRequestedDirectionName() {
  const params = new URLSearchParams(window.location.search);
  return params.get("direction") || "";
}

function findProgramIndexByDirection(programs, directionName) {
  const target = normalizeName(directionName);
  if (!target || !Array.isArray(programs) || programs.length === 0) {
    return 0;
  }

  const exactIndex = programs.findIndex((program) => normalizeName(program?.programName) === target);
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const partialIndex = programs.findIndex((program) => {
    const candidate = normalizeName(program?.programName);
    return candidate.includes(target) || target.includes(candidate);
  });

  return partialIndex >= 0 ? partialIndex : 0;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = html;
  }
}

function setPageTitle(universityName) {
  const cleanName = String(universityName || "Университет").trim() || "Университет";
  document.title = `${cleanName} | UniFinder`;
}

function populateProgramSelects(programs) {
  const mainSelect = document.getElementById("programSelectMain");
  const chanceSelect = document.getElementById("chanceProgramSelect");

  [mainSelect, chanceSelect].forEach((select) => {
    if (!select) return;
    select.innerHTML = '<option value="">Выберите направление</option>';

    programs.forEach((program, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${program.programName}${program.programCode ? ` (${program.programCode})` : ""}`;
      select.appendChild(option);
    });
  });
}

function renderProgramList(programs) {
  const list = document.getElementById("programList");
  if (!list) return;

  list.innerHTML = "";
  programs.forEach((program) => {
    const item = document.createElement("li");
    item.textContent = `${program.programName}${program.degree ? ` • ${program.degree}` : ""}${program.language ? ` • ${program.language}` : ""}`;
    list.appendChild(item);
  });

  const searchInput = document.getElementById("programSearch");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    const items = list.querySelectorAll("li");
    items.forEach((item) => {
      const isMatch = item.textContent.toLowerCase().includes(query);
      item.style.display = isMatch ? "list-item" : "none";
    });
  });
}

function renderRawData(correctedRows, transportRows) {
  const rows = [];

  correctedRows.forEach((entry, index) => {
    rows.push(`<h4>Запись программы ${index + 1}</h4>`);
    Object.entries(entry.row).forEach(([key, value]) => {
      rows.push(`<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value ?? "")}</div>`);
    });
  });

  transportRows.forEach((entry, index) => {
    rows.push(`<h4>Запись расходов ${index + 1}</h4>`);
    Object.entries(entry.row).forEach(([key, value]) => {
      rows.push(`<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value ?? "")}</div>`);
    });
  });

  setHtml("dbRawData", rows.length > 0 ? rows.join("") : "Нет данных по выбранному университету");
}

function resolveEntScoreText(program) {
  const directText = String(program?.passScoreText || "").trim();
  if (directText && directText.toLowerCase() !== "не указано") {
    return directText;
  }

  const directNumeric = toNumber(program?.passScoreValue);
  if (Number.isFinite(directNumeric)) {
    return String(Math.round(directNumeric));
  }

  const row = program?.row || {};
  const fallbackRaw = pickFirstNonEmpty(
    pickExactColumn(row, "col_14"),
    pickValue(row, ["pass", "ent", "threshold", "minimum", "min"], 13),
    String(program?.scoreRangeText || "").split("-")[0]
  );
  const fallbackNumeric = toNumber(fallbackRaw);
  if (Number.isFinite(fallbackNumeric)) {
    return String(Math.round(fallbackNumeric));
  }

  return "Нет данных";
}

function updateProgramDependentBlocks(programs, selectedIndex) {
  if (programs.length === 0) {
    setText("entMinScore", "Минимальный балл: Нет данных");
    setText("entThreshold", "Пороговый балл: Нет данных");
    setText("entContest", "Конкурс: Нет данных");
    setText("entGrant", "Гранты: Нет данных");
    setText("entApplicants", "Поступающих: Нет данных");
    setText("entScoreRange", "Диапазон баллов: Нет данных");
    setText("tuitionValue", "Стоимость: Нет данных");
    return;
  }

  const fallbackIndex = Number.isFinite(selectedIndex) && selectedIndex >= 0 && selectedIndex < programs.length ? selectedIndex : 0;
  const current = programs[fallbackIndex];

  const tuitionText = formatMoney(current.tuitionRaw);
  const entScoreText = resolveEntScoreText(current);
  setText("entMinScore", `Минимальный балл: ${entScoreText}`);
  setText("entThreshold", `Пороговый балл: ${entScoreText}`);
  setText("entContest", `Конкурс: ${current.contestText || "Нет данных"}`);
  setText("entGrant", `Гранты: ${current.grantText || "Нет данных"}`);
  setText("entApplicants", `Поступающих: ${current.applicantCountText || "Нет данных"}`);
  setText("entScoreRange", `Диапазон баллов: ${current.scoreRangeText || "Нет данных"}`);
  setText("tuitionValue", `Стоимость: ${tuitionText}`);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function calculateChanceScore(program, entValue) {
  const requiredScore = toNumber(program?.passScoreValue);
  if (!Number.isFinite(requiredScore)) {
    return NaN;
  }

  const contestCount = toNumber(program?.contestValue);
  const grantCount = toNumber(program?.grantValue);
  const applicantCount = toNumber(program?.applicantCountValue);

  const scoreGap = entValue - requiredScore;
  let score = 52 + scoreGap * 4.5;

  if (Number.isFinite(grantCount) && grantCount > 0) {
    const pressureBase = Number.isFinite(applicantCount) && applicantCount > 0
      ? applicantCount
      : Number.isFinite(contestCount) && contestCount > 0
        ? contestCount
        : grantCount;
    const grantShare = grantCount / pressureBase;
    score += clamp((grantShare - 0.25) * 45, -18, 18);
  }

  if (Number.isFinite(contestCount) && Number.isFinite(grantCount) && grantCount > 0) {
    const competitionRatio = contestCount / grantCount;
    score -= clamp((competitionRatio - 1) * 5, 0, 25);
  }

  if (Number.isFinite(applicantCount) && Number.isFinite(grantCount) && grantCount > 0) {
    const applicantRatio = applicantCount / grantCount;
    score -= clamp((applicantRatio - 1.5) * 2.5, 0, 20);
  }

  return clamp(score, 5, 95);
}

function getChanceLabel(score) {
  if (!Number.isFinite(score)) {
    return "Нет данных";
  }

  if (score >= 80) {
    return "Очень высокий";
  }

  if (score >= 65) {
    return "Высокий";
  }

  if (score >= 50) {
    return "Средний";
  }

  if (score >= 35) {
    return "Низкий";
  }

  return "Очень низкий";
}

function setupChanceCalculator(programs, transport, initialIndex = 0) {
  const entInput = document.getElementById("chanceEntInput");
  const programSelect = document.getElementById("chanceProgramSelect");

  if (programSelect && programs.length > 0) {
    const safeIndex = Number.isFinite(initialIndex) && initialIndex >= 0 && initialIndex < programs.length ? initialIndex : 0;
    programSelect.value = String(safeIndex);
  }

  function renderChance() {
    const entValue = toNumber(entInput?.value);
    const selectedIndex = Number.parseInt(programSelect?.value || "", 10);
    const selectedProgram = Number.isFinite(selectedIndex) && programs[selectedIndex] ? programs[selectedIndex] : programs[0];

    if (!Number.isFinite(entValue)) {
      setText("chanceResult", "Шанс поступления: Укажите балл ЕНТ");
      setText("chanceDetails", "");
      return;
    }

    const chanceScore = calculateChanceScore(selectedProgram, entValue);
    if (!Number.isFinite(chanceScore)) {
      setText("chanceResult", "Шанс поступления: Нет данных по выбранному направлению");
      setText("chanceDetails", "");
      return;
    }

    const requiredScore = toNumber(selectedProgram?.passScoreValue);
    const scoreGap = entValue - requiredScore;
    const gapText = `${scoreGap >= 0 ? "+" : ""}${Math.round(scoreGap)}`;

    setText("chanceResult", `Шанс поступления: ${getChanceLabel(chanceScore)} (${Math.round(chanceScore)}%)`);
    setText(
      "chanceDetails",
      `ЕНТ: ${Math.round(entValue)} • До проходного: ${gapText} • Конкурс: ${selectedProgram?.contestText || "Нет данных"} • Гранты: ${selectedProgram?.grantText || "Нет данных"} • Поступающих: ${selectedProgram?.applicantCountText || "Нет данных"}`
    );
  }

  [entInput, programSelect].forEach((el) => {
    if (el) {
      el.addEventListener("input", renderChance);
      el.addEventListener("change", renderChance);
    }
  });

  renderChance();
}

function renderMainBlocks(universityName, programs, transportRows) {
  const firstProgram = programs[0];
  const firstTransport = transportRows[0] || null;

  setPageTitle(universityName);

  setText("uniName", universityName || "Университет не найден");
  setText("uniCity", firstProgram?.city || "Город: Нет данных");

  setText("uniType", `Тип: ${firstProgram?.type || "Нет данных"}`);
  setText("uniEmail", `Email: ${firstProgram?.email || "Нет данных"}`);
  setText("uniPhone", `Телефон: ${firstProgram?.phone || "Нет данных"}`);
  setHtml("uniWebsite", `Сайт: ${firstProgram?.website ? `<a href="${escapeHtml(firstProgram.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(firstProgram.website)}</a>` : "Нет данных"}`);
  setHtml("uniProgramLink", `Ссылка на программу: ${firstProgram?.link ? `<a href="${escapeHtml(firstProgram.link)}" target="_blank" rel="noopener noreferrer">Открыть</a>` : "Нет данных"}`);

  setText("dormYearly", `Общежитие: ${formatMoneyOrText(firstTransport?.dormitory)}`);
  setText("apartmentCost", `Аренда: ${formatMoneyOrText(firstTransport?.apartment)}`);
  setText("livingTotal", `Итого расходов/мес: ${formatMoney(firstTransport?.total)}`);

  setText("foodCost", `Питание: ${formatMoney(firstTransport?.food)}`);
  setText("transportCost", `Транспорт: ${formatMoney(firstTransport?.transport)}`);
  setText("leisureCost", `Досуг: ${formatMoney(firstTransport?.leisure)}`);

  setupLivingModeSwitch(firstTransport);
}

function setupLivingModeSwitch(transport) {
  const dormRadio = document.getElementById("livingModeDorm");
  const apartmentRadio = document.getElementById("livingModeApartment");
  const dormLine = document.getElementById("dormYearly");
  const apartmentLine = document.getElementById("apartmentCost");

  if (!dormRadio || !apartmentRadio || !dormLine || !apartmentLine) {
    return;
  }

  const dormCost = toNumber(transport?.dormitory);
  const apartmentCost = toNumber(transport?.apartment);
  const foodCost = toNumber(transport?.food);
  const transportCost = toNumber(transport?.transport);
  const leisureCost = toNumber(transport?.leisure);
  const fallbackTotal = toNumber(transport?.total);

  const extraCosts = [foodCost, transportCost, leisureCost]
    .filter((value) => Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);

  function computeTotal(mode) {
    const livingCost = mode === "apartment" ? apartmentCost : dormCost;
    if (Number.isFinite(livingCost) && Number.isFinite(extraCosts)) {
      return livingCost + extraCosts;
    }
    return fallbackTotal;
  }

  function renderTotal() {
    const mode = apartmentRadio.checked ? "apartment" : "dorm";
    const total = computeTotal(mode);

    dormLine.style.display = mode === "dorm" ? "block" : "none";
    apartmentLine.style.display = mode === "apartment" ? "block" : "none";
    setText("livingTotal", `Итого расходов/мес: ${formatMoney(total)}`);
  }

  dormRadio.addEventListener("change", renderTotal);
  apartmentRadio.addEventListener("change", renderTotal);
  renderTotal();
}

function setupProgramLinkedFields(programs, initialIndex = 0) {
  const mainSelect = document.getElementById("programSelectMain");

  if (mainSelect) {
    mainSelect.addEventListener("change", () => {
      const idx = Number.parseInt(mainSelect.value || "", 10);
      updateProgramDependentBlocks(programs, idx);
    });
  }

  const safeIndex = Number.isFinite(initialIndex) && initialIndex >= 0 && initialIndex < programs.length ? initialIndex : 0;
  const initialValue = String(safeIndex);
  if (mainSelect) mainSelect.value = initialValue;
  updateProgramDependentBlocks(programs, safeIndex);
}

async function loadUniversityPage() {
  const targetName = getRequestedUniversityName();
  const targetDirection = getRequestedDirectionName();

  const unifiedResponse = await fetch("/api/universities?limit=1000&offset=0");

  if (!unifiedResponse.ok) {
    throw new Error("Не удалось загрузить данные");
  }

  const unifiedPayload = await unifiedResponse.json();
  const unifiedRows = (Array.isArray(unifiedPayload.rows) ? unifiedPayload.rows : []).map(normalizeCorrectedRow);

  const canonicalName = resolveCanonicalUniversityName(unifiedRows, targetName)
    || targetName;

  const filteredPrograms = findRowsByCanonicalName(unifiedRows, canonicalName);
  const filteredTransport = filteredPrograms;
  const initialProgramIndex = findProgramIndexByDirection(filteredPrograms, targetDirection);

  const resolvedName = canonicalName || filteredPrograms[0]?.name || filteredTransport[0]?.name || "Университет";

  renderMainBlocks(resolvedName, filteredPrograms, filteredTransport);
  populateProgramSelects(filteredPrograms);
  renderProgramList(filteredPrograms);
  setupProgramLinkedFields(filteredPrograms, initialProgramIndex);
  setupChanceCalculator(filteredPrograms, filteredTransport[0], initialProgramIndex);
  renderRawData(filteredPrograms, filteredTransport);
}

loadUniversityPage().catch(() => {
  setPageTitle("Университет");
  setText("uniName", "Не удалось загрузить данные университета");
  setText("uniCity", "Проверьте подключение к API");
  setHtml("dbRawData", "Ошибка загрузки данных.");
});
