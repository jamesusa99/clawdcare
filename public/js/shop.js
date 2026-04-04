(function () {
  var STORAGE = "clawdcare_cart";

  function getCart() {
    try {
      var c = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      return Array.isArray(c) ? c : [];
    } catch (_) {
      return [];
    }
  }

  function setCart(cart) {
    localStorage.setItem(STORAGE, JSON.stringify(cart));
    window.dispatchEvent(new Event("clawdcare:cart"));
  }

  function addItem(id, name, priceCents, qty) {
    qty = qty || 1;
    var cart = getCart();
    var found = cart.find(function (x) { return x.id === id; });
    if (found) found.qty += qty;
    else cart.push({ id: id, name: name, priceCents: priceCents, qty: qty });
    setCart(cart);
  }

  function renderCart() {
    var list = document.getElementById("cart-lines");
    var totalEl = document.getElementById("cart-total");
    if (!list) return;
    var cart = getCart();
    list.innerHTML = "";
    var total = 0;
    cart.forEach(function (line) {
      var sub = line.priceCents * line.qty;
      total += sub;
      var li = document.createElement("li");
      li.style.cssText = "display:flex;justify-content:space-between;gap:1rem;padding:0.5rem 0;border-bottom:1px solid var(--border);color:var(--muted);font-size:0.875rem";
      li.innerHTML =
        "<span>" +
        escapeHtml(line.name) +
        " × " +
        line.qty +
        '</span><span style="color:var(--text)">$' +
        (sub / 100).toFixed(2) +
        "</span>";
      list.appendChild(li);
    });
    if (cart.length === 0) {
      list.innerHTML = "<li style=\"color:var(--dim);font-size:0.875rem\">Cart is empty.</li>";
    }
    if (totalEl) totalEl.textContent = "$" + (total / 100).toFixed(2);
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-add-cart]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var name = btn.getAttribute("data-name");
        var price = parseInt(btn.getAttribute("data-price"), 10);
        addItem(id, name, price, 1);
        btn.textContent = "Added ✓";
        setTimeout(function () {
          btn.textContent = btn.getAttribute("data-label") || "Add to cart";
        }, 1200);
      });
    });
    renderCart();

    var checkout = document.getElementById("checkout-btn");
    if (checkout) {
      checkout.addEventListener("click", function () {
        var cart = getCart();
        if (!cart.length) {
          alert("Your cart is empty.");
          return;
        }
        var subj = encodeURIComponent("ClawdCare order inquiry");
        var body = encodeURIComponent(
          "Please process the following cart:\n\n" +
            cart
              .map(function (l) {
                return "- " + l.name + " x" + l.qty + " ($" + ((l.priceCents * l.qty) / 100).toFixed(2) + ")";
              })
              .join("\n")
        );
        window.location.href = "mailto:hello@clawdcare.com?subject=" + subj + "&body=" + body;
      });
    }
  });
})();
