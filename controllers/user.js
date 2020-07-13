const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
// const mongoose = require('mongoose');
const redisClient = require('../redis')
const User = require('../models/user')

const signToken = (email) => {
    const jwtPayload = { email }
    return jwt.sign(jwtPayload, process.env.JWTSECRET, {
        expiresIn: '3 days'
    })
}

// returns token on success and throws error on failure
const createSession = (user) => {
    // create jwt and user data
    const { _id, email } = user
    const token = signToken(email)

    return new Promise((resolve, reject) => {
        // save token in redis - note: _id is an object, so stringify needed
        // set session to expire in 10 days
        redisClient.setex(
            token,
            259200, // 3 days
            JSON.stringify(_id),
            (err, result) => {
                if (err) {
                    reject(new Error('error in saving token to redis'))
                } else {
                    resolve(token)
                }
            }
        )
    })
}

// a function that validates username/password and returns a promise
// on success, should return the user
const handleSignIn = (email, password) => User.findOne({ email })
    .then((user) => {
        if (!user) {
            return null
        }
        const { _id } = user
        return bcrypt
            .compare(password, user.password)
            .then((doMatch) => (doMatch ? _id : null))
            .catch(() => null)
    })
    .catch((err) => {
        console.log(err)
        return null
    })

// for the login route
exports.user_login = async (req, res, next) => {
    // TODO: need to check for case where loggin unneccessarily?
    // const { authorization } = req.headers
    // if (authorization) {
    //     return res.json({
    //         message: 'already authenticated'
    //         token: authorization
    //     })
    // }
    // no auth token

    const { email, password } = req.body
    if (!email || !password) {
        return res.status(400).json({ error: { message: 'invalid input' } })
    }
    try {
        const userId = await handleSignIn(email, password) // handleSignIn validates login info
        if (!userId) {
            return res.status(404).json({ error: { message: 'no such user' } })
        }
        console.log({ userId })
        const token = await createSession(userId, email) // returns the token 
        console.log('from session creation: ', token)
        return token
            ? res.status(200).json({
                message: 'authentication successful',
                token,
                userId
            })
            : res
                .status(500)
                .json({ error: { message: 'server failed to save data' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            error: { message: 'something went wrong', details: err.message }
        })
    }
}

exports.user_profile = async (req, res) => {
    const userId = req.params.id
    console.log('user id received in profile req: ', userId)
    return User.findOne({ _id: userId }) // mongo id in User stored as _id

        .populate('cart')
        .then((user) => {
            if (!user) {
                return res.status(400).json({
                    error: {
                        message: 'invalid profile request',
                        detail: 'user id not found'
                    }
                })
            }
            const { email, cart, name } = user
            return res.status(200).json({ email, cart, name })
        })
}

exports.user_logout = (req, res) => {
    const { authorization } = req.headers
    // this case is an anomoly
    if (!authorization) {
        return res.status(400).json({ error: { message: 'not authorized' } })
    }
    redisClient.del(authorization, (err, response) => {
        if (response === 1) {
            console.log('logged out')
            return res.status(200).json({ message: 'sign out successful ' })
        }
        console.log('error logging out')
        return res
            .status(500)
            .json({
                error: { message: 'error signing out', detail: err }
            })
    })
}

exports.user_register = async (req, res) => {
    const { name, email, password } = req.body
    try {
        // first check if user already exists
        const userDoc = await User.findOne({ email })
        if (userDoc) {
            return res
                .status(400)
                .json({ error: { message: 'user already exists' } })
        }
        const hashedPassword = await bcrypt.hash(password, 12)
        const user = new User({
            name,
            password: hashedPassword,
            email,
            cart: []
        })
        const savedUser = await user.save()
        // const sessionInfo = await createSession(savedUser) // createSession returns a promise
        // if (sessionInfo.token) {
        //     // token created
        //     console.log('session token created and sent in register route')
        //     return res.status(200).json({
        //         id: user._id,
        //         token: sessionInfo.token,
        //         message: 'registration successful'
        //     })
        // // eslint-disable-next-line no-else-return
        // } else {
        //     throw new Error('server error during token creation')
        // }
        return res
            .status(200)
            .json({ id: savedUser._id, message: 'registration successful' })
    } catch (err) {
        console.log(err.message)
        return res
            .status(500)
            .json({ error: { message: 'server error', detail: err.message } })
    }
}
