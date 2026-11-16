type ToastVariant = "default" | "success";
type ToastWindow = Window & { _tt?: number };

export function useToast() {
  function showToast(message: string, variant: ToastVariant = "default") {
    if (!import.meta.client) return;

    const toast = document.getElementById("toast");
    if (!toast) {
      console.error("Application toast element is unavailable.");
      return;
    }

    const toastWindow = window as ToastWindow;
    window.clearTimeout(toastWindow._tt);
    toast.textContent = message;
    toast.classList.toggle("toast-success", variant === "success");
    toast.classList.add("show");
    toastWindow._tt = window.setTimeout(() => {
      toast.classList.remove("show", "toast-success");
      toast.textContent = "";
    }, 3400);
  }

  return { showToast };
}
