var express = require("express");
require("ejs");
var bodyParser = require("body-parser");
var mysql = require("mysql");
var session = require("express-session");

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "shop",
});

var app = express();

app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: "secret" }));

function isProductInCart(cart, id) {
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].id == id) {
      return true;
    }
  }
  return false;
}
function calculateTotal(cart, req) {
  var total = 0;
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].sale_price) {
      total += cart[i].sale_price * cart[i].quantity;
    } else {
      total += cart[i].price * cart[i].quantity;
    }
  }
  req.session.total = total;
  return total;
}

app.get("/", function (req, res) {
  con.query("SELECT * FROM products", function (err, result) {
    if (err) throw err;
    res.render("pages/index", { result: result });
  });
});

app.post("/add_to_cart", function (req, res) {
  var id = req.body.id;
  var name = req.body.name;
  var price = req.body.price;
  var sale_price = req.body.sale_price;
  var quantity = req.body.quantity;
  var image = req.body.image;
  var product = {
    id: id,
    name: name,
    price: price,
    sale_price: sale_price,
    quantity: quantity,
    image: image,
  };
  if (req.session.cart) {
    var cart = req.session.cart;
    if (!isProductInCart(cart, id)) {
      cart.push(product);
    }
  } else {
    req.session.cart = [];
    req.session.cart.push(product);
  }
  res.redirect("/cart");
});

app.get("/cart", function (req, res) {
  var cart = req.session.cart;
  if (!cart) res.render("pages/cart", { cart: [], total: 0 });
  else {
    calculateTotal(req.session.cart, req);
    var total = req.session.total;
    res.render("pages/cart", { cart: cart, total: total });
  }
});

app.post("/remove_product", function (req, res) {
  var cart = req.session.cart;
  cart = cart.filter((item) => {
    return item.id != req.body.id;
  });
  req.session.cart = cart;
  res.redirect("/cart");
});

app.post("/edit_product_quantity", function (req, res) {
  var cart = req.session.cart;
  if (req.body.edit_btn === "-") {
    cart = cart.map((item) => {
      if (item.id == req.body.id) {
        if (item.quantity >= 1) {
          item.quantity--;
        }
      }
      return item;
    });
    cart = cart.filter((item) => {
      return item.quantity != 0;
    });
  } else {
    cart = cart.map((item) => {
      if (item.id == req.body.id) {
        item.quantity++;
      }
      return item;
    });
  }
  req.session.cart = cart;
  res.redirect("/cart");
});

app.get("/checkout", function (req, res) {
  var cart = req.session.cart;
  if (!cart) res.redirect("/cart");
  else {
    calculateTotal(cart, req);
    var total = req.session.total;
    res.render("pages/checkout", { total: total });
  }
});

app.post("/place_order", function (req, res) {
  var cart = req.session.cart;
  var cost = req.session.total;
  var name = req.body.name;
  var email = req.body.email;
  var phone = req.body.phone;
  var city = req.body.city;
  var address = req.body.address;
  var status = "not paid";
  var date = new Date();
  var product_ids = "";
  var id = Date.now();
  req.session.order_id = id;

  var order = {
    id: id,
    name: name,
    email: email,
    phone: phone,
    city: city,
    address: address,
    cost: cost,
    status: status,
    date: date,
    product_ids: product_ids,
  };

  for (let i = 0; i < cart.length; i++) {
    product_ids += cart[i].id + ",";
  }

  con.query("INSERT INTO orders SET ?", order, function (err, result) {
    if (err) throw err;
    orderId = result.insertId;
    for (let i = 0; i < cart.length; i++) {
      var order_item = {
        order_id: orderId,
        product_id: cart[i].id,
        product_name: cart[i].name,
        product_price: cart[i].price,
        product_image: cart[i].image,
        product_quantity: cart[i].quantity,
        order_date: date,
      };
      con.query(
        "INSERT INTO order_items SET ?",
        order_item,
        function (err, result) {
          if (err) throw err;
        }
      );
    }
    req.session.cart = [];
    res.redirect("/payment");
  });
});

app.get("/payment", function (req, res) {
  var total = req.session.total;
  res.render("pages/payment", { total: total });
});

app.get("/verify_payment", function (req, res) {
  var transaction_id = req.query.transaction_id;
  var order_id = req.session.order_id;
  console.log(transaction_id);

  var payment = {
    order_id: order_id,
    transaction_id: transaction_id,
    date: new Date(),
  };

  con.query("INSERT INTO payments SET ?", payment, function (err, result) {
    if (err) throw err;
    con.query(
      "UPDATE orders SET status = 'paid' WHERE id = ?",
      order_id,
      function (err, result) {
        if (err) throw err;
        res.redirect("/thank_you");
      }
    );
  });
});

app.get("/thank_you", function (req, res) {
  var order_id = req.session.order_id;
  res.render("pages/thank_you", { order_id: order_id });
});

app.get("/single_product", function (req, res) {
  var id = req.query.id;
  con.query("SELECT * FROM products WHERE id = ?", id, function (err, result) {
    if (err) throw err;
    res.render("pages/single_product", { result: result });
  });
});

app.get("/products", function (req, res) {
  con.query("SELECT * FROM products", function (err, result) {
    if (err) throw err;
    res.render("pages/products", { result: result });
  });
});

app.get("/about", function (req, res) {
  res.render("pages/about");
});

app.listen(8000, () => {
  console.log("http://localhost:8000");
});
