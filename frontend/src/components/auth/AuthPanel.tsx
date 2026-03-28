import { useState, type CSSProperties } from "react";
import { AUTH_PROVIDER_CONFIG } from "../../auth/providerConfig";
import { useAuth } from "../../auth/AuthContext";

type AuthMode = "sign-in" | "sign-up" | "reset" | "update-password";

type AuthPanelProps = {
  compact?: boolean;
};

function formatAuthError(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "That request could not be completed.";
}

export default function AuthPanel({ compact = false }: AuthPanelProps) {
  const {
    isConfigured,
    isLoading,
    isRecoveryMode,
    user,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
  } = useAuth();

  const [isOpen, setIsOpen] = useState(!compact);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedMode: AuthMode = isRecoveryMode ? "update-password" : mode;

  const resetMessages = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    resetMessages();
    setIsSubmitting(true);

    try {
      if (resolvedMode === "sign-in") {
        await signIn(email.trim(), password);
        setStatusMessage("You are signed in.");
        setPassword("");
      } else if (resolvedMode === "sign-up") {
        const nextMessage = await signUp(email.trim(), password);
        setStatusMessage(nextMessage ?? "Account created and signed in.");
        setPassword("");
        setConfirmPassword("");
      } else if (resolvedMode === "reset") {
        await requestPasswordReset(email.trim());
        setStatusMessage("Password reset instructions have been sent.");
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await updatePassword(password);
        setStatusMessage("Your password has been updated.");
        setPassword("");
        setConfirmPassword("");
        setMode("sign-in");
      }
    } catch (error) {
      setErrorMessage(formatAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onModeChange = (nextMode: AuthMode) => {
    resetMessages();
    setMode(nextMode);
  };

  const renderBody = () => {
    if (!isConfigured) {
      return <div style={bodyTextStyle}>Supabase auth is not configured for this frontend build.</div>;
    }

    if (isLoading) {
      return <div style={bodyTextStyle}>Checking your session...</div>;
    }

    if (user) {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={bodyTextStyle}>Signed in as {user.email ?? user.id}</div>
          {isRecoveryMode && (
            <>
              <div style={labelStyle}>New password</div>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={inputStyle}
              />
              <div style={labelStyle}>Confirm password</div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                style={inputStyle}
              />
              <button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting} style={primaryButtonStyle}>
                {isSubmitting ? "Updating..." : "Update password"}
              </button>
            </>
          )}
          {!isRecoveryMode && (
            <button
              type="button"
              onClick={() => void signOut().catch((error) => setErrorMessage(formatAuthError(error)))}
              style={secondaryButtonStyle}
            >
              Sign out
            </button>
          )}
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 10 }}>
        {resolvedMode !== "update-password" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => onModeChange("sign-in")} style={mode === "sign-in" ? activeModeButtonStyle : modeButtonStyle}>
              Sign in
            </button>
            <button type="button" onClick={() => onModeChange("sign-up")} style={mode === "sign-up" ? activeModeButtonStyle : modeButtonStyle}>
              Create account
            </button>
            <button type="button" onClick={() => onModeChange("reset")} style={mode === "reset" ? activeModeButtonStyle : modeButtonStyle}>
              Reset password
            </button>
          </div>
        )}

        <div style={labelStyle}>Email</div>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={inputStyle}
          autoComplete="email"
        />

        {resolvedMode !== "reset" && (
          <>
            <div style={labelStyle}>{resolvedMode === "update-password" ? "New password" : "Password"}</div>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={inputStyle}
              autoComplete={resolvedMode === "sign-in" ? "current-password" : "new-password"}
            />
          </>
        )}

        {resolvedMode === "sign-up" && (
          <>
            <div style={labelStyle}>Confirm password</div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              style={inputStyle}
              autoComplete="new-password"
            />
          </>
        )}

        <button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting} style={primaryButtonStyle}>
          {isSubmitting
            ? "Working..."
            : resolvedMode === "sign-in"
              ? "Sign in"
              : resolvedMode === "sign-up"
                ? "Create account"
                : resolvedMode === "reset"
                  ? "Send reset email"
                  : "Update password"}
        </button>

        {AUTH_PROVIDER_CONFIG.oauthProviders.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            {AUTH_PROVIDER_CONFIG.oauthProviders.map((provider) => (
              <button key={provider.id} type="button" disabled style={secondaryButtonStyle}>
                {provider.label} coming soon
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        minWidth: compact ? 220 : undefined,
        padding: compact ? "10px 12px" : "14px 16px",
        borderRadius: 16,
        border: "1px solid rgba(144, 151, 169, 0.25)",
        background: "rgba(12, 16, 24, 0.88)",
        color: "#F2F4F8",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9BA8BC" }}>
            Account
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {user ? user.email ?? "Signed in" : "Sign in to save your work"}
          </div>
        </div>
        {compact && (
          <button type="button" onClick={() => setIsOpen((current) => !current)} style={modeButtonStyle}>
            {isOpen ? "Hide" : user ? "Manage" : "Open"}
          </button>
        )}
      </div>

      {isOpen && (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {renderBody()}
          {statusMessage && <div style={{ ...bodyTextStyle, color: "#8FD4A8" }}>{statusMessage}</div>}
          {errorMessage && <div style={{ ...bodyTextStyle, color: "#F58C8C" }}>{errorMessage}</div>}
        </div>
      )}
    </div>
  );
}

const bodyTextStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: "#C5CEDB",
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#9BA8BC",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid rgba(144, 151, 169, 0.25)",
  background: "rgba(19, 24, 36, 0.95)",
  color: "#F2F4F8",
  padding: "10px 12px",
  fontSize: 13,
};

const baseButtonStyle: CSSProperties = {
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid rgba(144, 151, 169, 0.25)",
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "#E7B95B",
  color: "#171A22",
};

const secondaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "rgba(19, 24, 36, 0.95)",
  color: "#F2F4F8",
};

const modeButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  padding: "6px 10px",
};

const activeModeButtonStyle: CSSProperties = {
  ...modeButtonStyle,
  borderColor: "rgba(231, 185, 91, 0.75)",
  color: "#E7B95B",
};
