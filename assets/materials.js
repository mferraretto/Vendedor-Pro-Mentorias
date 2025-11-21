const stateKey = "materiais-gratuitos-state-v1";
const submissionKey = "materiais-gratuitos-submissions-v1";
const secret = "materiais-gratuitos-crypto-key";

const defaultState = {
  heroTitle: "Acesse Suas Planilhas Gratuitas Para Vender Mais na Shopee",
  heroSubtitle:
    "Preencha seu pré-cadastro para receber acesso imediato às planilhas profissionais de precificação, controle de pedidos, Shopee Ads e muito mais.",
  ctaTitle: "Acesse suas planilhas exclusivas",
  ctaSubtitle:
    "Complete o pré-cadastro para receber imediatamente o acesso aos arquivos mais pedidos pelos vendedores da Shopee.",
  materials: [],
};

let state = loadState();
let selectedMaterialId = null;
let downloadUnlocked = false;
let isAdmin = sessionStorage.getItem("isAdmin") === "true";
let cryptoKeyPromise = null;

const materialsGrid = document.querySelector("[data-materials-grid]");
const adminPanel = document.querySelector("[data-admin-panel]");
const adminMaterials = document.querySelector("[data-admin-materials]");
const downloadModal = document.querySelector("[data-download-modal]");
const downloadForm = document.querySelector("[data-download-form]");
const downloadSuccess = document.querySelector("[data-download-success]");
const feedback = document.querySelector("[data-form-feedback]");
const successList = document.querySelector("[data-success-list]");
const downloadNow = document.querySelector("[data-download-now]");

renderTexts();
renderMaterials();
renderAdmin();
attachEvents();
notifyAdminState();

function loadState() {
  try {
    const raw = localStorage.getItem(stateKey);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    const materials = normalizeMaterials(parsed.materials || defaultState.materials);
    return {
      ...defaultState,
      ...parsed,
      materials: materials.filter((material) => material.isAdminManaged),
    };
  } catch (error) {
    console.error("Erro ao carregar estado", error);
    return { ...defaultState };
  }
}

function saveState() {
  state.materials = getAdminMaterials();
  localStorage.setItem(stateKey, JSON.stringify(state));
}

function normalizeMaterials(materials = []) {
  return (materials || []).map((material) => {
    const description = material.description?.toLowerCase() || "";
    const isAdminManaged =
      material.isAdminManaged ||
      material.source === "admin" ||
      material.url?.toString().startsWith("data:") ||
      description.includes("importada");

    return { ...material, isAdminManaged: Boolean(isAdminManaged) };
  });
}

function getAdminMaterials() {
  return (state.materials || []).filter((item) => item.isAdminManaged);
}

function renderTexts() {
  document.querySelectorAll("[data-bind='heroTitle']").forEach((el) => (el.textContent = state.heroTitle));
  document.querySelectorAll("[data-bind='heroSubtitle']").forEach((el) => (el.textContent = state.heroSubtitle));
  document.querySelectorAll("[data-bind='ctaTitle']").forEach((el) => (el.textContent = state.ctaTitle));
  document.querySelectorAll("[data-bind='ctaSubtitle']").forEach((el) => (el.textContent = state.ctaSubtitle));
}

function renderMaterials() {
  if (!materialsGrid) return;
  materialsGrid.innerHTML = "";
  const materials = getAdminMaterials();
  if (!materials.length) {
    const empty = document.createElement("p");
    empty.className = "materials-empty";
    empty.textContent = "Nenhuma planilha disponível. Faça login como administrador para importar.";
    materialsGrid.appendChild(empty);
    return;
  }

  materials.forEach((material) => {
    const card = document.createElement("article");
    card.className = "material-card";
    const adminBar = isAdmin
      ? `<div class="material-admin-bar">
          <span class="material-admin-label">Modo administrador</span>
          <div class="material-admin-actions">
            <button type="button" class="btn-ghost-small" data-admin-edit="${material.id}">Editar</button>
            <button type="button" class="btn-ghost-small danger" data-admin-delete="${material.id}">Excluir</button>
          </div>
        </div>`
      : "";

    card.innerHTML = `
      <header class="card-header">
        <div class="card-kicker">Download liberado após cadastro</div>
        <h3 class="card-title">${material.title}</h3>
      </header>
      <p class="card-body">${material.description}</p>
      ${adminBar}
      <div class="card-actions">
        <button class="btn-outline" type="button" data-download="${material.id}">Baixar</button>
      </div>
    `;
    materialsGrid.appendChild(card);
  });
}

function renderAdmin() {
  if (!adminMaterials) return;
  adminMaterials.innerHTML = "";
  getAdminMaterials().forEach((material) => {
    const wrapper = document.createElement("div");
    wrapper.className = "admin-material-row";
    wrapper.innerHTML = `
      <label class="admin-field">Título
        <input type="text" value="${material.title}" data-material-edit="title" data-id="${material.id}" />
      </label>
      <label class="admin-field">Descrição
        <input type="text" value="${material.description}" data-material-edit="description" data-id="${material.id}" />
      </label>
      <label class="admin-field">Link direto
        <input type="text" value="${material.url}" data-material-edit="url" data-id="${material.id}" />
      </label>
    `;
    adminMaterials.appendChild(wrapper);
  });
}

function attachEvents() {
  document.querySelectorAll("[data-open-form]").forEach((button) =>
    button.addEventListener("click", () => openForm())
  );

  materialsGrid?.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest("[data-admin-delete]");
    if (deleteBtn) {
      event.preventDefault();
      const id = deleteBtn.getAttribute("data-admin-delete");
      removeMaterial(id);
      return;
    }

    const editBtn = event.target.closest("[data-admin-edit]");
    if (editBtn) {
      event.preventDefault();
      const id = editBtn.getAttribute("data-admin-edit");
      startEditMaterial(id);
      return;
    }

    const button = event.target.closest("[data-download]");
    if (!button) return;
    const id = button.getAttribute("data-download");
    openForm(id);
  });

  document.querySelectorAll("[data-close-download]").forEach((btn) =>
    btn.addEventListener("click", () => toggleModal(false))
  );

  downloadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormLoading(true);
    downloadUnlocked = false;

    try {
      const formData = new FormData(downloadForm);
      const payload = {
        nome: formData.get("nome")?.toString().trim(),
        email: formData.get("email")?.toString().trim(),
        whatsapp: formData.get("whatsapp")?.toString().trim(),
        perfil: formData.get("perfil")?.toString(),
        consentimento: formData.get("consentimento") === "on",
        materialId: selectedMaterialId,
        createdAt: new Date().toISOString(),
      };

      if (!payload.nome || !payload.email || !payload.whatsapp || !payload.perfil || !payload.consentimento) {
        setFeedback("Preencha todos os campos e aceite o termo para continuar.", "error");
        setFormLoading(false);
        return;
      }

      await saveEncryptedSubmission(payload);
      downloadUnlocked = true;
      showSuccess(payload);
    } catch (error) {
      console.error(error);
      setFeedback("Não foi possível salvar o cadastro. Tente novamente.", "error");
    } finally {
      setFormLoading(false);
    }
  });

  downloadNow?.addEventListener("click", () => {
    if (downloadUnlocked) {
      triggerDownload(selectedMaterialId);
    }
  });

  document.querySelector("[data-import-planilhas]")?.addEventListener("change", handleImport);
  document.querySelector("[data-download-submissions]")?.addEventListener("click", exportSubmissions);

  document.querySelectorAll("[data-edit]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const target = event.target;
      const key = target.getAttribute("data-edit");
      state[key] = target.value;
      saveState();
      renderTexts();
    });
  });

  adminMaterials?.addEventListener("input", (event) => {
    const target = event.target;
    if (!target.matches("[data-material-edit]")) return;
    const key = target.getAttribute("data-material-edit");
    const id = target.getAttribute("data-id");
    const material = state.materials.find((item) => item.id === id);
    if (!material) return;
    material[key] = target.value;
    saveState();
    renderMaterials();
  });

  document.addEventListener("admin-auth-changed", (event) => {
    const isAdmin = !!event.detail?.isAdmin;
    toggleAdmin(isAdmin);
  });
}

function openForm(materialId = null) {
  selectedMaterialId = materialId;
  downloadUnlocked = false;
  downloadForm?.reset();
  downloadSuccess?.setAttribute("hidden", "true");
  downloadForm?.removeAttribute("hidden");
  setFeedback("Dados criptografados e uso interno.");
  toggleModal(true);
}

function toggleModal(show) {
  if (!downloadModal) return;
  downloadModal.classList.toggle("is-visible", show);
  downloadModal.setAttribute("aria-hidden", show ? "false" : "true");
  document.body.classList.toggle("modal-open", show);
}

function setFormLoading(isLoading) {
  const submit = downloadForm?.querySelector("[data-submit-download]");
  if (submit) submit.disabled = isLoading;
}

function setFeedback(message, type = "info") {
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.remove("error", "success");
  if (type !== "info") feedback.classList.add(type);
}

function showSuccess(payload) {
  if (!downloadSuccess || !downloadForm) return;
  downloadForm.setAttribute("hidden", "true");
  downloadSuccess.removeAttribute("hidden");
  setFeedback("Cadastro salvo com segurança.", "success");

  successList.innerHTML = "";
  const materials = getAdminMaterials();
  if (!materials.length) {
    const item = document.createElement("li");
    item.textContent = "Nenhuma planilha importada no momento.";
    successList.appendChild(item);
    return;
  }

  materials.forEach((material) => {
    const item = document.createElement("li");
    item.textContent = material.title;
    successList.appendChild(item);
  });

  triggerDownload(selectedMaterialId);
}

async function saveEncryptedSubmission(payload) {
  const encrypted = await encrypt(payload);
  const current = loadEncryptedSubmissions();
  current.push(encrypted);
  localStorage.setItem(submissionKey, JSON.stringify(current));
}

function loadEncryptedSubmissions() {
  try {
    const raw = localStorage.getItem(submissionKey);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.error("Erro ao ler submissões", error);
    return [];
  }
}

async function exportSubmissions() {
  const encrypted = loadEncryptedSubmissions();
  if (!encrypted.length) {
    alert("Nenhum cadastro para exportar.");
    return;
  }

  const decrypted = [];
  for (const item of encrypted) {
    try {
      const data = await decrypt(item);
      decrypted.push(data);
    } catch (error) {
      console.warn("Falha ao decifrar um registro", error);
    }
  }

  if (!decrypted.length) {
    alert("Não foi possível decifrar os cadastros salvos.");
    return;
  }

  const header = ["Nome", "Email", "WhatsApp", "Perfil", "Material", "Data"];
  const rows = decrypted.map((row) => [
    row.nome,
    row.email,
    row.whatsapp,
    row.perfil,
    row.materialId || "geral",
    row.createdAt,
  ]);

  const csv = [header, ...rows]
    .map((line) => line.map((value) => `"${(value || "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "formularios-materiais.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function triggerDownload(id) {
  const materials = getAdminMaterials();
  const material = materials.find((item) => item.id === id) || materials[0];
  if (!material?.url) return;
  const link = document.createElement("a");
  link.href = material.url;
  link.download = material.title.replace(/\s+/g, "-").toLowerCase();
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function handleImport(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  for (const file of files) {
    const base64 = await readFileAsBase64(file);
    const id = `${file.name.replace(/\W+/g, "-").toLowerCase()}-${Date.now()}`;
    state.materials.push({
      id,
      title: file.name,
      description: "Planilha importada pelo administrador.",
      url: base64,
      isAdminManaged: true,
    });
  }

  saveState();
  renderMaterials();
  renderAdmin();
  event.target.value = "";
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toggleAdmin(show) {
  if (!adminPanel) return;
  adminPanel.hidden = !show;
  adminPanel.classList.toggle("is-visible", show);
  isAdmin = show;
  renderMaterials();
}

function notifyAdminState() {
  const stored = sessionStorage.getItem("isAdmin") === "true";
  toggleAdmin(stored);
}

function startEditMaterial(id) {
  const material = state.materials.find((item) => item.id === id);
  if (!material) return;

  const title = prompt("Edite o título da planilha:", material.title);
  if (title === null) return;

  const description = prompt("Edite a descrição:", material.description);
  if (description === null) return;

  const url = prompt("Atualize o link direto:", material.url);
  if (url === null) return;

  material.title = title.trim() || material.title;
  material.description = description.trim() || material.description;
  material.url = url.trim() || material.url;

  saveState();
  renderMaterials();
  renderAdmin();
}

function removeMaterial(id) {
  const index = state.materials.findIndex((item) => item.id === id);
  if (index === -1) return;

  const shouldRemove = confirm("Excluir esta planilha? Esta ação não pode ser desfeita.");
  if (!shouldRemove) return;

  state.materials.splice(index, 1);
  saveState();
  renderMaterials();
  renderAdmin();
}

async function encrypt(data) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getCryptoKey();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(data)));
  return {
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(encrypted),
  };
}

async function decrypt(payload) {
  const key = await getCryptoKey();
  const iv = base64ToArrayBuffer(payload.iv);
  const data = base64ToArrayBuffer(payload.data);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function getCryptoKey() {
  if (!cryptoKeyPromise) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
    cryptoKeyPromise = crypto.subtle.importKey(
      "raw",
      keyMaterial,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  }

  return cryptoKeyPromise;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
