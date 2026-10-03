
(() => {
  const form = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const button = document.getElementById("login-button");
  const status = document.getElementById("status");

  function showStatus(message, type = "") {
    status.textContent = message;
    status.className = `status ${type}`.trim();
  }

  function setLoading(loading) {
    button.disabled = loading;
    button.classList.toggle("loading", loading);
    button.querySelector(".button-label").textContent =
      loading ? "Signing in…" : "Sign in";
  }

  // Avoid signing in again when a valid session already exists.
  const token = sessionStorage.getItem(window.APP_CONFIG.SESSION_TOKEN_KEY);
  const expiresAt = Number(
    sessionStorage.getItem(window.APP_CONFIG.SESSION_EXPIRY_KEY) || 0
  );

  if (token && expiresAt > Date.now()) {
    window.location.replace("home.html");
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    showStatus("");

    const apiUrl = window.APP_CONFIG?.API_URL;

    if (!apiUrl || apiUrl.includes("PASTE_YOUR_")) {
      showStatus("Configure the Apps Script URL in js/config.js.", "error");
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showStatus("Enter both username and password.", "error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "login",
          username,
          password
        }),
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error("The login service returned an HTTP error.");
      }

      const result = await response.json();

      if (!result.success || !result.token || !result.expiresAt) {
        showStatus(
          result.message || "Invalid username or password.",
          "error"
        );
        return;
      }

      sessionStorage.setItem(
        window.APP_CONFIG.SESSION_TOKEN_KEY,
        result.token
      );

      sessionStorage.setItem(
        window.APP_CONFIG.SESSION_EXPIRY_KEY,
        String(result.expiresAt)
      );

      passwordInput.value = "";
      window.location.replace("home.html");
    } catch (error) {
      console.error("Login request failed:", error);

      showStatus(
        "Could not contact the login service. Check the Apps Script URL, deployment access, and browser console.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  });
})();