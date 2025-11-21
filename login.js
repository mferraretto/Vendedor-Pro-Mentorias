import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const firebaseConfig =
  window.firebaseConfig ||
  window.FIREBASE_CONFIG || {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_AUTH_DOMAIN",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_STORAGE_BUCKET",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID",
  };

const modalTemplate = `
  <div class="login-overlay" id="login-overlay" hidden></div>
  <div class="login-modal" id="login-modal" hidden>
    <div class="login-card">
      <div class="login-card-header">
        <div>
          <p class="login-kicker">Acesso restrito</p>
          <h2 class="login-title">Área administrativa</h2>
          <p class="login-subtitle">Faça login com e-mail e senha cadastrados como administrador.</p>
        </div>
        <button class="login-close" id="login-close" type="button" aria-label="Fechar">
          ×
        </button>
      </div>

      <form id="login-form" class="login-form">
        <label class="login-label" for="login-email">E-mail</label>
        <input
          id="login-email"
          name="email"
          type="email"
          class="login-input"
          placeholder="email@exemplo.com"
          required
        />

        <label class="login-label" for="login-password">Senha</label>
        <input
          id="login-password"
          name="password"
          type="password"
          class="login-input"
          placeholder="Digite sua senha"
          required
        />

        <div class="login-status" id="login-status"></div>

        <button class="btn-primary login-submit" type="submit">Entrar</button>
      </form>
    </div>
  </div>
`;

if (!document.getElementById("login-overlay")) {
  document.body.insertAdjacentHTML("beforeend", modalTemplate);
}

const loginButton = document.getElementById("admin-login-button");
const overlay = document.getElementById("login-overlay");
const modal = document.getElementById("login-modal");
const closeButton = document.getElementById("login-close");
const form = document.getElementById("login-form");
const emailInput = document.getElementById("login-email");
const passwordInput = document.getElementById("login-password");
const statusEl = document.getElementById("login-status");
const submitButton = document.querySelector(".login-submit");

let firebaseApp;
let firebaseAuth;
let firestore;

const isConfigReady = (config) =>
  Boolean(
    config?.apiKey &&
      config?.projectId &&
      !config.apiKey.includes("SUA_API_KEY") &&
      !config.projectId.includes("SEU_PROJECT_ID")
  );

const ensureFirebase = () => {
  if (!isConfigReady(firebaseConfig)) {
    throw new Error(
      "Configuração do Firebase ausente. Defina window.firebaseConfig ou preencha os campos do firebaseConfig."
    );
  }

  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(firebaseApp);
    firestore = getFirestore(firebaseApp);
  }

  return { auth: firebaseAuth, db: firestore };
};

const setStatus = (message, type = "info") => {
  statusEl.textContent = message;
  statusEl.dataset.state = type;
};

const toggleModal = (show) => {
  if (show) {
    modal?.removeAttribute("hidden");
    overlay?.removeAttribute("hidden");
    emailInput?.focus({ preventScroll: true });
  } else {
    modal?.setAttribute("hidden", "true");
    overlay?.setAttribute("hidden", "true");
    form?.reset();
    setStatus("");
  }
};

const toggleLoading = (isLoading) => {
  if (isLoading) {
    submitButton?.setAttribute("disabled", "true");
    submitButton.textContent = "Validando...";
  } else {
    submitButton?.removeAttribute("disabled");
    submitButton.textContent = "Entrar";
  }
};

loginButton?.addEventListener("click", () => toggleModal(true));
overlay?.addEventListener("click", () => toggleModal(false));
closeButton?.addEventListener("click", () => toggleModal(false));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal?.hasAttribute("hidden")) {
    toggleModal(false);
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  toggleLoading(true);
  setStatus("Validando credenciais...", "info");

  try {
    const { auth, db } = ensureFirebase();
    const { user } = await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );

    const userRef = doc(db, "usuarios", user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists() || (userDoc.data().perfil || "").toUpperCase() !== "ADM") {
      await signOut(auth);
      throw new Error("Acesso restrito: apenas administradores podem entrar.");
    }

    setStatus("Login aprovado para perfil ADM.", "success");
  } catch (error) {
    const message =
      error.message ===
      "Configuração do Firebase ausente. Defina window.firebaseConfig ou preencha os campos do firebaseConfig."
        ? "Preencha a configuração do Firebase antes de tentar logar."
        : error?.message || "Não foi possível realizar o login.";

    setStatus(message, "error");
  } finally {
    toggleLoading(false);
  }
});
