const express = require('express');
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const knex = require('knex')


const db = knex({
    client: 'pg',
    connection: {
        host : '127.0.0.1',
        user : 'postgres',
        port : 5432,
        password : 'test',
        database : 'Riff-Wired'
    }
});

const app = express();

app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.use(cors());

app.get('/products/type/:type', (req, res) => {
    const type = req.params.type;

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

app.post('/login', (req, res) => {
    db.select('email', 'hash').from('login')
    .where('email', '=', req.body.email)
    .then(data => {
        const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
        if (isValid) {
            return db.select('*').from('users')
            .where('email', '=', req.body.email)
            .then(user => {
                console.log(isValid)
                res.json(user[0])
            })
            .catch(err => res.status(400).json('unable to get user'))
        }
    })
    .catch(err => res.status(400).json('wrong credentials'))
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

app.post('/create-review', (req,res) => {
    const { id, content } = req.body;

    if (!id || !content) {
        return res.status(400).json({ error: 'User ID and content are required' });
    }

    const user = database.users.find(user => user.id === id);


    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    user.review = content;

    res.status(201).json({ message: 'Review created and associated with the user', review: user.review });
});

app.get('/review/:id', (req, res) => {
    const { id } = req.params;
    
    const user = database.users.find(user => user.id === id);

    if (user) {
        res.json(user.review);
    } else {
        res.status(404).json('User not found');
    }
});


app.listen(3000, ()=> {
    console.log('Server is listening on port 3000');
});
