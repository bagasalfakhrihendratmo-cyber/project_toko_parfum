const express = require('express');
const { dbPool } = require('./db');
const {render} = require('ejs');
const path = require('path')
const methodOverride = require ('method-override');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const port = 3001;

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(methodOverride(function(req,res){
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    let method = req.body._method
    delete req.body._method
    return method
  }
    }));

app.use(express.static(path.join(__dirname, 'public')));

const multer = require('multer');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Append extension
    }
});

const upload = multer({ storage: storage });

app.use(session({
    secret: 'your_secret_key', // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

dbPool.getConnection((err, connection) =>{
    if(err){
        console.log(`Failed connect to database: ${err.message}` )
    } else {
        console.log(`Terhubung!, tiada galat yang ditemukan\nWaktu request:(${new Date()})`);
        connection.release()
    }
})

app.use((req, res, next) => {
  console.log(`database connect successfully! `);
  next();
}); 

// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).send('Access Denied: Admins only');
    }
};

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
};

app.get("/", (req, res) => {
  // If not authenticated, send to login first
  if (!req.session || !req.session.user) return res.redirect('/login');
  // If admin, go to admin dashboard
  if (req.session.user.role === 'admin') return res.redirect('/admin');
  // Otherwise go to user home (public storefront)
  return res.redirect('/home');
});

// User home (requires authentication)
app.get('/home', isAuthenticated, (req, res) => {
  dbPool.query('SELECT * FROM perfumes', (err, results) => {
    if(err){
      return res.status(500).send('Failed to retrieve perfumes');
    }
    res.render('index', { perfumes: results, user: req.session.user });
  });
});

app.get("/about", (req, res) => {
  res.render("about", { title: "GSPRO kantin", user: req.session.user });
});

app.get("/contact", (req, res) => {
  res.render("contact", { title: "GSPRO kantin", user: req.session.user });
});

// User Registration
app.get('/register', (req, res) => {
    res.render('register', { title: 'Register', user: req.session.user });
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        dbPool.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, 'user'],
            (err, results) => {
                if (err) {
                    return res.status(500).send('Failed to register user: ' + err.message);
                }
                res.redirect('/login');
            }
        );
    } catch (error) {
        res.status(500).send('Error registering user.');
    }
});

// User Login
app.get('/login', (req, res) => {
    res.render('login', { title: 'Login', user: req.session.user });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    dbPool.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err) {
            return res.status(500).send('Error logging in: ' + err.message);
        }
        if (results.length === 0) {
            return res.status(400).send('Invalid credentials');
        }
        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
      req.session.user = { id: user.id, username: user.username, role: user.role };
      // Redirect based on role
      if (user.role === 'admin') return res.redirect('/admin');
      return res.redirect('/home');
        } else {
            res.status(400).send('Invalid credentials');
        }
    });
});

// User Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Failed to log out.');
        }
        res.redirect('/login');
    });
});

// Admin Perfume Management
app.get("/admin", isAuthenticated, isAdmin, (req, res) => {
    dbPool.query('SELECT * FROM perfumes', (err, results) => {
        if(err){
            return res.status(500).send('Failed to retrieve perfumes for admin');
        }
        res.render("admin_perfumes", { title: "Admin - Manage Perfumes", perfumes: results, user: req.session.user });
    });
});

app.get("/perfume", (req, res) => {
  dbPool.query('SELECT * FROM perfumes', (err, results) => {
    if(err){
      return res.status(500).send('Failed to retrieve perfumes');
    }
    res.render("perfume", { title: "GSPRO KANTIN", perfumes: results, user: req.session.user });
    
   });
});

app.get("/create-perfume", isAuthenticated, isAdmin, (req, res) => {
  res.render("create", { title:"GSPRO KANTIN", user: req.session.user });
  
});

app.post("/create-perfume", isAuthenticated, isAdmin, upload.single('image'), (req,res) =>{
      const {name, description, price, stock} = req.body;
      const image = req.file ? '/uploads/' + req.file.filename : null;
      const stockVal = parseInt(stock, 10) || 0;
      dbPool.query(
        'INSERT INTO perfumes (name, description, price, image, stock) VALUES (?, ?, ?, ?, ?)',
        [name, description, price, image, stockVal], (err, results) => {
          if(err){
            return res.status(500).send('Failed to add perfume');
          }
          res.redirect('/admin');
        }
      );
        
})

app.get('/update-perfume/:id', isAuthenticated, isAdmin, (req,res) =>{
  const { id } = req.params;
  dbPool.query('SELECT * FROM perfumes WHERE id = ?', [id], (err, results) => {
    if (err) {
      return res.status(400).send('Failed to retrieve perfume');
    }
    results.map((perfume) => {
      res.render('update', { title: 'Update Perfume', perfume, user: req.session.user });
    });
  });
});

app.put('/update-perfume/:id', isAuthenticated, isAdmin, upload.single('image'), (req,res) =>{
  const { id } = req.params;
  const { name, description, price, stock } = req.body;
  
  dbPool.query('SELECT image FROM perfumes WHERE id = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).send('Failed to retrieve perfume for update: ' + err.message);
    }
    if (results.length === 0) {
      return res.status(404).send('Perfume not found');
    }
    
    const oldImage = results[0].image;
    const image = req.file ? '/uploads/' + req.file.filename : oldImage;
    const stockVal = parseInt(stock, 10) || 0;

    dbPool.query(
      'UPDATE perfumes SET name = ?, description = ?, price = ?, image = ?, stock = ? WHERE id = ?',
      [name, description, price, image, stockVal, id],
      (err, results) => {
        if (err) {
          // If there's an error and a new file was uploaded, delete it
          if (req.file) {
            fs.unlinkSync(path.join(uploadDir, req.file.filename));
          }
          return res.status(500).send('Failed to update perfume: ' + err.message);
        }
        if (results.affectedRows === 0) {
          return res.status(404).send('Perfume not found');
        }
        
        // If a new image was uploaded and it's different from the old one, delete the old image
        if (req.file && oldImage && oldImage !== image) {
            const oldImagePath = path.join(__dirname, 'public', oldImage);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }
        
        res.redirect('/admin');
      }
    );
  });
});

app.delete('/delete-perfume/:id' , isAuthenticated, isAdmin, (req, res) => {
          const { id } = req.params;
          dbPool.query(
            'DELETE FROM perfumes WHERE id = ?' ,
            [id],
            (err, result) => {
              if (err) {
                return res.status(500).send('Failed to delete perfume: ' + err.message);
              }
              if (result.affectedRows === 0) {
                return res.status(404).send('Perfume not found. ');
              }
              res.redirect('/admin');
            }
          );
        });


// Buy route - show purchase page (only for authenticated users)
app.get('/buy/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  dbPool.query('SELECT * FROM perfumes WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).send('Failed to retrieve perfume');
    if (!results || results.length === 0) return res.status(404).send('Perfume not found');
    const perfume = results[0];
    res.render('buy', { perfume, user: req.session.user });
  });
});

// Handle purchase submission (simple confirmation, no DB persistence)
app.post('/buy/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const { recipient, address, quantity, payment } = req.body;
  const qty = parseInt(quantity, 10) || 1;

  // Use a transaction to safely decrement stock
  dbPool.getConnection((err, connection) => {
    if (err) return res.status(500).send('DB connection error');
    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        return res.status(500).send('Failed to start transaction');
      }
      connection.query('SELECT stock, price, name, description, image FROM perfumes WHERE id = ? FOR UPDATE', [id], (err, results) => {
        if (err) {
          return connection.rollback(() => { connection.release(); res.status(500).send('Failed to retrieve perfume'); });
        }
        if (!results || results.length === 0) {
          return connection.rollback(() => { connection.release(); res.status(404).send('Perfume not found'); });
        }
        const row = results[0];
        const stockAvailable = parseInt(row.stock, 10) || 0;
        if (stockAvailable < qty) {
          // Not enough stock
          connection.rollback(() => { connection.release();
            const perfume = { id, name: row.name, description: row.description, image: row.image, price: row.price, stock: stockAvailable };
            return res.status(400).render('buy', { perfume, user: req.session.user, error: 'Stok tidak cukup untuk jumlah yang diminta.' });
          });
        } else {
          // Decrement stock
          connection.query('UPDATE perfumes SET stock = stock - ? WHERE id = ?', [qty, id], (err, result) => {
            if (err) {
              return connection.rollback(() => { connection.release(); res.status(500).send('Failed to update stock'); });
            }
            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => { connection.release(); res.status(500).send('Commit failed'); });
              }
              connection.release();
              const perfume = { id, name: row.name, description: row.description, image: row.image, price: row.price };
              return res.render('buy_success', { perfume, quantity: qty, address, payment, user: req.session.user });
            });
          });
        }
      });
    });
  });
});


app.listen(port, (req, res) => {
  console.log(" your server jalan di jalan lontar bawah rt 8 rw 12 http://localhost:" + port);
});
