import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Configuração fornecida pelo usuário para o projeto sistema-ebc-ac-usa
const firebaseConfig = {
  apiKey: "AIzaSyD6DqcbuOKFQIjSSifNjn__wwy5panMA64",
  authDomain: "sistema-ebc-ac-usa.firebaseapp.com",
  projectId: "sistema-ebc-ac-usa",
  storageBucket: "sistema-ebc-ac-usa.firebasestorage.app",
  messagingSenderId: "145213839300",
  appId: "1:145213839300:web:a99f817702cc6938a67691",
  measurementId: "G-3DTQ1CF830"
};

// Inicializa o Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Inicializa o Analytics de forma segura caso suportado no ambiente
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  }).catch(() => {});
}

// Validação de conexão conforme as boas práticas do skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Por favor, verifique sua conexão ou configuração do Firebase.");
    }
  }
}
testConnection();
