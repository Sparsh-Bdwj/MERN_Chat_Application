import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthProvider.jsx";
import { ChatProvider } from "../context/ChatProvider.jsx";
import { CallProvider } from "../context/CallProvider.jsx";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <ChatProvider>
        <CallProvider>
          <App />
        </CallProvider>
      </ChatProvider>
    </AuthProvider>
  </BrowserRouter>,
);
