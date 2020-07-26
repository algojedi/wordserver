const express = require('express')
const { body } = require('express-validator')
const isValid = require('../middleware/validator')
const isAuth = require('../middleware/is-auth')

const UserController = require('../controllers/user')

const router = express.Router()

router.post('/register', [
    // username must be an email
    body('email').isEmail(),
    // password must be at least 4 chars
    body('password').isLength({ min: 5 })
], isValid, UserController.user_register)

router.post('/login', UserController.user_login)

router.get('/profile', isAuth, UserController.user_profile)

router.post('/logout', UserController.user_logout)

module.exports = router
