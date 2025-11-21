import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Substitua pelos valores reais do seu projeto Firebase ou defina window.FIREBASE_CONFIG antes deste script carregar.
const firebaseConfig =
  window.FIREBASE_CONFIG ||
  Object.freeze({
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_BUCKET.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID",
  });

const modal = document.querySelector("[data-login-modal]");
const openButton = document.querySelector("[data-login-trigger]");
const closeButtons = document.querySelectorAll("[data-login-close]");
const loginForm = document.querySelector("[data-login-form]");
const feedback = document.querySelector("[data-login-feedback]");
const emailInput = document.querySelector("#login-email");
const passwordInput = document.querySelector("#login-password");

const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];
const hasValidConfig = requiredKeys.every((key) => {
  const value = firebaseConfig[key];
  if (!value || typeof value !== "string") return false;
  return !value.includes("SEU_") && !value.includes("SUA_");
});

let app;
let auth;
let db;
let isReady = false;

if (hasValidConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  isReady = true;
} else {
  console.warn(
    "Configuração do Firebase ausente. Defina window.FIREBASE_CONFIG com apiKey, authDomain, projectId e appId para habilitar o login."
  );
}

function setStatus(message, type = "info") {
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.remove("success", "error");
  if (type !== "info") {
    feedback.classList.add(type);
  }
}

function toggleModal(show) {
  if (!modal) return;
  modal.classList.toggle("is-visible", show);
  document.body.classList.toggle("modal-open", show);

  if (show) {
    setStatus("Use seu usuário administrador cadastrado.");
    emailInput?.focus();
  } else {
    loginForm?.reset();
  }
}

openButton?.addEventListener("click", () => toggleModal(true));
closeButtons.forEach((button) =>
  button.addEventListener("click", () => toggleModal(false))
);
modal?.addEventListener("click", (event) => {
  if (event.target === modal) {
    toggleModal(false);
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") toggleModal(false);
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isReady || !auth || !db) {
    setStatus(
      "Configure o Firebase (window.FIREBASE_CONFIG) para habilitar o login.",
      "error"
    );
    return;
  }

  const email = emailInput?.value.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    setStatus("Preencha email e senha para continuar.", "error");
    return;
  }

  const submitButton = loginForm.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  setStatus("Validando credenciais...");

  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const isAdmin = await validateAdmin(user);

    if (isAdmin) {
      setStatus("Acesso liberado. Perfil administrador confirmado.", "success");
      setAdminSession(true, user.email);
      toggleModal(false);
    } else {
      await signOut(auth);
      setStatus("Seu usuário não possui perfil ADM nesta área.", "error");
      setAdminSession(false);
    }
  } catch (error) {
    console.error(error);
    const message =
      error?.code === "auth/invalid-credential"
        ? "Credenciais inválidas. Confira email e senha."
        : error?.message || "Erro ao entrar. Tente novamente.";
    setStatus(message, "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

function setAdminSession(isAdmin, email = "") {
  if (isAdmin) {
    sessionStorage.setItem("isAdmin", "true");
  } else {
    sessionStorage.removeItem("isAdmin");
  }

  const event = new CustomEvent("admin-auth-changed", {
    detail: { isAdmin, email },
  });
  document.dispatchEvent(event);
}

if (sessionStorage.getItem("isAdmin") === "true") {
  document.dispatchEvent(
    new CustomEvent("admin-auth-changed", { detail: { isAdmin: true } })
  );
}

async function validateAdmin(user) {
  if (!user?.email) return false;
  const email = user.email;

  const adminDoc = (await findUserDoc("email", email)) ||
    (await findUserDoc("nome", email));

  if (adminDoc && adminDoc.perfil) {
    return adminDoc.perfil.toString().toUpperCase() === "ADM";
  }

  return false;
}

async function findUserDoc(field, value) {
  if (!value) return null;
  const adminsRef = collection(db, "usuarios");
  const snapshot = await getDocs(
    query(adminsRef, where(field, "==", value), limit(1))
  );

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  return null;
}
