import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { AuthProvider } from "react-oidc-context";

const onSigninCallback = (): void => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

const oidcAuthority = process.env.REACT_APP_OIDC_AUTHORITY || "";
const oidcClientId = process.env.REACT_APP_OIDC_CLIENT_ID || "";

const oidcConfig = oidcAuthority
  ? {
      authority: oidcAuthority,
      client_id: oidcClientId,
      redirect_uri: window.location.origin,
      responseType: "code",
      scope: "openid profile email",
      automaticSilentRenew: true,
      onSigninCallback,
    }
  : null;

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  oidcConfig ? (
    <AuthProvider {...oidcConfig}>
      <App bootstrapUrl={process.env.REACT_APP_BOOTSTRAP_URL || ""} />
    </AuthProvider>
  ) : (
    <App bootstrapUrl={process.env.REACT_APP_BOOTSTRAP_URL || ""} />
  )
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
