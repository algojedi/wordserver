const express = require('express')
const User = require('../models/user')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Session = require('../models/session')

const router = express.Router()

const getTokenId = (req, res) => {
    const { authorization } = req.headers //authorization is the token

    return Session.findOne({ token: authorization }, (err, reply) => {
        if (err || !reply) {
            console.log(err)
            return res.status(400).json('Authorization denied')
        }
        console.log('reply returned from DB sesh: ', reply)
        return res.json({
            success: true,
            userId: reply.userId,
            token: reply.token,
        })
    }).catch((err) => console.log('error finding session, ', err))
}

const signToken = (email) => {
    const jwtPayload = { email }
    return jwt.sign(jwtPayload, process.env.JWTSECRET, { expiresIn: '2 days' })
}

//This function saves the session to the database
const setToken = (token, userId) => {
    const session = new Session({
        token,
        userId,
    })
    //calling function expecting a Promise, hence...
    return Promise.resolve(session.save())
}

const createSessions = (user) => {
    //create jwt and user data
    const { _id, email } = user
    const token = signToken(email)
    //id can be used to retrieve full user object via another endpoint
    //login should only be responsible for validation
    return setToken(token, _id)
        .then(() => {
            return { success: true, userId: _id, token }
        })
        .catch((err) => console.log(err))
}

router.post('/login', (req, res, next) => {
    console.log('attempting login')
    const { authorization } = req.headers

    return authorization
        ? getTokenId(req, res) //extract and send id from DB
        : //if getTokenId does not return, then create new session
          handleSignIn(req, res) //handleSignIn validates login info
              //if the login info is correct, create session
              .then((data) => {
                  //data is the user
                  return data._id && data.email
                      ? createSessions(data)
                      : Promise.reject(data)
              })
              .then((session) => res.json(session))
              .catch((err) => res.status(400).json(err))
})

//a function that validates username/password and returns a promise
const handleSignIn = (req, res) => {
    const { email, password } = req.body
    if (!email || !password) {
        return Promise.reject('incorrect form submission')
    }
    return User.findOne({ email: email })
        .then((user) => {
            if (!user) {
                return Promise.reject('incorrect email or password')
            }
            return bcrypt
                .compare(password, user.password)
                .then((doMatch) => {
                    console.log('brcypt match? ', doMatch)
                    return doMatch
                        ? user //TODO: Need to filter this to not return hashed pw inside user obj
                        : Promise.reject('incorrect email or password')
                })
                .catch((err) => {
                    Promise.reject(err)
                    //res.redirect('/home'); //error with bcrypt process
                })
        })
        .catch((err) => Promise.reject(err))
}

router.get('/profile/:id', (req, res) => {
    const userId = req.params.id
    return User.findOne({ _id: userId }) //mongo id in User stored as _id

        .populate('cart') //TODO: cart not populating wordId
        .then((user) => {
            if (!user) {
                return res.status(400).json('incorrect user id')
            }
            const { email, cart, name } = user
            return res.json({ email, cart, name })
        })
})

router.post('/logout', (req, res, next) => {
    req.session.destroy((err) => {
        console.log(err)
        res.redirect('/home')
    })
})

router.get('/checkauth', (req, res, next) => {
    if (!'session' in req) {
        res.end()
    }
    return 'user' in req.session ? res.send(user) : res.send('no user found')
})

router.post('/register', async (req, res, next) => {
    const { name, email, password } = req.body
    //first check if user already exists
    try {
        const userDoc = await User.findOne({ email })
        if (userDoc) {
            return res.status(400).send({ message: 'user already exists' })
        }
    } catch (err) {
        console.log(err)
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = new User({
        name,
        password: hashedPassword,
        email,
        cart: [],
    })
    user.save((err, user) => {
        return err
            ? res.status(400).send('Could not create user')
            : res.status(200).send('successfully created new user')
    })
})

module.exports = router
