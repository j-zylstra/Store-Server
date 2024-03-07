const express = require('express');
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const knex = require('knex')
const session = require('cookie-session');
const bodyParser = require('body-parser');
const path = require('path');

const PORT = process.env.PORT || 3001;

const db = knex({
    client: 'pg',
    connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
    }}, 
host: process.env.DATABASE_HOST,
port: 5432,
user: process.env.DATABASE_USER,
password: process.env.DATABASE_PW,
database: process.env.DATABASE_DB,});

const app = express();


const allowedOrigins = [
    "https://riff-wired-27891913b14e.herokuapp.com", 
]

app.use(cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
  }));

  
app.use(express.static(path.join(__dirname, 'index.html')));

app.get('/sale', (req, res) => {
    res.sendFile(path.join(__dirname, 'sale.html'));
  });

app.use(
    session({
      secret: process.env.SECRET_KEY,
      resave: false,
      saveUninitialized: true,
      cookie: { secure: true }
    })
  );


 app.use((req, res, next) => {
    console.log('Received request:', req.url);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
 })


app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.use(bodyParser.json());


app.get('/products/type/:type', (req, res) => {

    const type = req.params.type;

    console.log('Received request for products of type:', type);

    db.select('id', 'type', 'name', 'price', 'oldprice', 'instock', 'imgsrc')
    .from('products')
    .where('type', '=', type)
    .then(data => {
            res.json(data);
            
        })
        .catch(error => {
            console.error('Error:', error);
            res.status(500).json({ error: 'Something went wrong' });
        });
});

app.get('/products/:id', (req, res) => {
    const id = req.params.id;

    console.log('Received request for product with id:', id);

    db.select('id', 'type', 'name', 'price', 'instock', 'imgsrc')
    .from('products')
    .where('id', '=', id)
    .then(data => {
        if (data.length === 1) {
        
            const product = {
                id: data[0].id,
                type: data[0].type,
                name: data[0].name,
                price: data[0].price,
                instock: data[0].instock,
                imgsrc: data[0].imgsrc
            };

            res.json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    })
        .catch(error => {
            console.error('Error:', error);
            res.status(500).json({ error: 'Something went wrong' });
        });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    try {
      // Check if the email exists in the 'login' table
      const loginData = await db.select('email', 'hash').from('login').where('email', '=', email);
  
      if (loginData.length === 0) {
        throw new Error('Invalid credentials');
      }
  
      // Compare the entered password with the stored hash
      const isValid = bcrypt.compareSync(password, loginData[0].hash);
  
      if (isValid) {
        // If the password is valid, retrieve the user from the 'users' table
        const userData = await db.select('*').from('users').where('email', '=', email);
  
        if (userData.length === 0) {
          throw new Error('Unable to get user');
        }
  
        // Store the user ID in the session after successful login
        req.session.userId = userData[0].id, userData[0].name;
        const responseData = { userId: userData[0].id, name: userData[0].name};
        console.log('Response Data:', responseData);
        res.json(responseData);
        
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      console.error(error.message);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

app.post('/register', (req, res) => {
    const { email, name, password } = req.body;
    const hash = bcrypt.hashSync(password); 
        db.transaction(trx => {
            trx.insert({
                hash: hash,
                email: email
            })
            .into('login')
            .returning('email')
            .then(loginEmail => {
                return trx('users')
                .returning('*')
                .insert({
                    email: loginEmail[0].email,
                    name: name,
                    joined: new Date()
                })
                .then(user => {
                    res.json(user[0]);
                })
            })
            .then(trx.commit)
            .catch(trx.rollback)
        })
    .catch(err => res.status(400).json('unable to register'))
});

app.get('/profile/:id', (req,res) => {
    const { id } = req.params;
    db.select('*').from('users').where({
        id: id
    })
    .then(user => {
        if (user.length) {
            res.json(user[0])
        } else {}
        res.status(400).json('Not Found')
    })
    .catch(err => res.status(400).json('not found'))
});

app.post('/reviews', async (req, res) => {
    const { userId, comment } = req.body;

    try {
        const result = await db('reviews')
          .insert({ user_id: userId, content: comment })
          .returning('*');

          const user = await db('users').where({ id: userId }).first();

        res.json({
            content: result[0].content,
            userName: user.name
    });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/reviews/DB', async (req, res) => {
    try {
        const reviews = await db('reviews')
            .select('content', 'user_id') // Select content and user_id from reviews table
            .leftJoin('users', 'reviews.user_id', 'users.id') // Join with users table
            .select('users.name as userName'); // Select the name column from users table with alias userName

        res.json({
            reviews,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('*', (req, res) => {
    console.log('Serving index.html for unmatched route');
    res.sendFile(path.join(__dirname, 'index.html'));
  });

app.listen(PORT, ()=> {
    console.log(`Server is listening on port ${PORT}`);
});
