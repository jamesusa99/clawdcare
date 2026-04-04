(function () {
  var STORAGE = "clawdcare_cart";
  var MAX_QTY = 99;

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
    var found = cart.find(function (x) {
      return x.id === id;
    });
    if (found) found.qty = Math.min(MAX_QTY, found.qty + qty);
    else cart.push({ id: id, name: name, priceCents: priceCents, qty: Math.min(MAX_QTY, qty) });
    setCart(cart);
  }

  function updateQty(id, delta) {
    var cart = getCart();
    var i = cart.findIndex(function (x) {
      return x.id === id;
    });
    if (i < 0) return;
    cart[i].qty += delta;
    if (cart[i].qty < 1) cart.splice(i, 1);
    else if (cart[i].qty > MAX_QTY) cart[i].qty = MAX_QTY;
    setCart(cart);
    renderCart();
  }

  function setLineQty(id, n) {
    var cart = getCart();
    var found = cart.find(function (x) {
      return x.id === id;
    });
    if (!found) return;
    if (!Number.isFinite(n) || n < 1) {
      setCart(
        cart.filter(function (x) {
          return x.id !== id;
        })
      );
      renderCart();
      return;
    }
    found.qty = Math.min(MAX_QTY, Math.max(1, Math.floor(n)));
    setCart(cart);
    renderCart();
  }

  function removeLine(id) {
    setCart(
      getCart().filter(function (x) {
        return x.id !== id;
      })
    );
    renderCart();
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
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
      li.className = "shop-cart-line";
      li.innerHTML =
        '<div class="shop-cart-line__info">' +
        '<span class="shop-cart-line__name">' +
        escapeHtml(line.name) +
        '</span><div class="shop-cart-line__qty" role="group" aria-label="Quantity for ' +
        escapeHtml(line.name) +
        '">' +
        '<button type="button" class="btn btn-ghost shop-cart-line__qtybtn" data-cart-act="minus" data-id="' +
        escapeHtml(line.id) +
        '" aria-label="Decrease quantity">−</button>' +
        '<input type="number" class="shop-cart-qty-input" min="1" max="' +
        MAX_QTY +
        '" value="' +
        line.qty +
        '" data-id="' +
        escapeHtml(line.id) +
        '" aria-label="Quantity" />' +
        '<button type="button" class="btn btn-ghost shop-cart-line__qtybtn" data-cart-act="plus" data-id="' +
        escapeHtml(line.id) +
        '" aria-label="Increase quantity">+</button>' +
        '</div></div>' +
        '<div class="shop-cart-line__aside">' +
        '<span class="shop-cart-line__price">$' +
        (sub / 100).toFixed(2) +
        '</span>' +
        '<button type="button" class="btn btn-ghost shop-cart-line__remove" data-cart-act="remove" data-id="' +
        escapeHtml(line.id) +
        '">Remove</button>' +
        "</div>";
      list.appendChild(li);
    });
    if (cart.length === 0) {
      list.innerHTML = '<li class="shop-cart-empty">Cart is empty.</li>';
    }
    if (totalEl) totalEl.textContent = "$" + (total / 100).toFixed(2);
  }

  function bindCartListEvents() {
    var list = document.getElementById("cart-lines");
    if (!list || list.dataset.bound) return;
    list.dataset.bound = "1";
    list.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-cart-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-cart-act");
      var id = btn.getAttribute("data-id");
      if (!id) return;
      if (act === "minus") updateQty(id, -1);
      if (act === "plus") updateQty(id, 1);
      if (act === "remove") removeLine(id);
    });
    list.addEventListener("change", function (e) {
      var inp = e.target;
      if (!inp.classList.contains("shop-cart-qty-input")) return;
      var id = inp.getAttribute("data-id");
      if (!id) return;
      setLineQty(id, parseInt(inp.value, 10));
    });
    list.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var inp = e.target;
      if (!inp.classList.contains("shop-cart-qty-input")) return;
      inp.blur();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-add-cart]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var name = btn.getAttribute("data-name");
        var price = parseInt(btn.getAttribute("data-price"), 10);
        addItem(id, name, price, 1);
        renderCart();
        btn.textContent = "Added ✓";
        setTimeout(function () {
          btn.textContent = btn.getAttribute("data-label") || "Add to cart";
        }, 1200);
      });
    });
    bindCartListEvents();
    renderCart();

    var checkout = document.getElementById("checkout-btn");
    if (checkout) {
      checkout.addEventListener("click", function () {
        var cart = getCart();
        if (!cart.length) {
          alert("Your cart is empty.");
          return;
        }
        var subj = encodeURIComponent("ClawdCare — Place order / payment");
        var lines = cart.map(function (l) {
          return "- " + l.name + " × " + l.qty + " @ $" + (l.priceCents / 100).toFixed(2) + " ea = $" + ((l.priceCents * l.qty) / 100).toFixed(2);
        });
        var sum = cart.reduce(function (s, l) {
          return s + l.priceCents * l.qty;
        }, 0);
        var body = encodeURIComponent(
          "Please confirm this order and send payment instructions (invoice or payment link).\n\n" +
            lines.join("\n") +
            "\n\nEstimated total: $" +
            (sum / 100).toFixed(2) +
            "\n\n(Prices before tax/shipping; final total from your team.)\n"
        );
        window.location.href = "mailto:hello@clawdcare.com?subject=" + subj + "&body=" + body;
      });
    }
  });
})();
