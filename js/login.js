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
    button.querySelector(".button-label").textContent = loading ? "Signing in…" : "Sign in";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showStatus("");

    const apiUrl = window.APP_CONFIG?.API_URL;
    if (!apiUrl || apiUrl.includes("PASTE_YOUR_")) {
      showStatus("Setup required: add your deployed Apps Script URL in js/config.js.", "error");
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
      /*
       * text/plain avoids a CORS preflight for this cross-origin request.
       * Apps Script must still return a response the browser permits this
       * origin to read. See README.md if the browser reports a CORS error.
       */
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "login", username, password }),
        redirect: "follow"
      });

      if (!response.ok) throw new Error("The login service returned an HTTP error.");
      const result = await response.json();

      if (!result.success || !result.token) {
        showStatus(result.message || "Invalid username or password.", "error");
        return;
      }

      // Keep the token only for this browser tab's session.
      sessionStorage.setItem("billCreatorToken", result.token);
      sessionStorage.setItem("billCreatorTokenExpiresAt", String(result.expiresAt));

      passwordInput.value = "";
      showStatus("Login successful. Your session is ready.", "success");

      // Placeholder destination for the next step in the project.
      window.location.href = "welcome.html";
    } catch (error) {
      console.error("Login request failed:", error);
      showStatus(
        "Could not contact the login service. Check the Apps Script URL, deployment access, and browser console for CORS errors.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  });
})();
