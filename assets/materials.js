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
  materials: [
    {
      id: "precificacao",
      title: "Planilha de Precificação Shopee",
      description: "Calcule preços e margens com segurança.",
      url: "assets/planilha-precificacao.csv",
    },
    {
      id: "pedidos",
      title: "Controle de Pedidos",
      description: "Organize envios e entregas sem perder prazo.",
      url: "assets/planilha-controle-pedidos.csv",
    },
    {
      id: "ads",
      title: "Shopee Ads – Registro e Análise",
      description: "Acompanhe investimentos e resultados das campanhas.",
      url: "assets/planilha-shopee-ads.csv",
    },
    {
      id: "margem",
      title: "Calculadora de Margem e Comissão",
      description: "Simule comissões e margens por produto.",
      url: "assets/planilha-margem-comissao.csv",
    },
    {
      id: "seo",
      title: "Buscador de Palavras-chave (Shopee SEO)",
      description: "Planeje SEO para anúncios com termos de alta conversão.",
      url: "assets/planilha-palavras-chave.csv",
    },
  ],
};

let state = loadState();
let selectedMaterialId = null;
let downloadUnlocked = false;

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
    return { ...defaultState, ...parsed, materials: parsed.materials || defaultState.materials };
  } catch (error) {
    console.error("Erro ao carregar estado", error);
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(stateKey, JSON.stringify(state));
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
  state.materials.forEach((material) => {
    const card = document.createElement("article");
    card.className = "material-card";
    card.innerHTML = `
      <header class="card-header">
        <div class="card-kicker">Download liberado após cadastro</div>
        <h3 class="card-title">${material.title}</h3>
      </header>
      <p class="card-body">${material.description}</p>
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
  state.materials.forEach((material) => {
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
  state.materials.forEach((material) => {
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
  const material = state.materials.find((item) => item.id === id) || state.materials[0];
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
}

function notifyAdminState() {
  const stored = sessionStorage.getItem("isAdmin") === "true";
  toggleAdmin(stored);
}

async function encrypt(data) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(data)));
  return {
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(encrypted),
  };
}

async function decrypt(payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), "AES-GCM", false, ["decrypt"]);
  const iv = base64ToArrayBuffer(payload.iv);
  const data = base64ToArrayBuffer(payload.data);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
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
