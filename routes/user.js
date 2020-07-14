const express = require('express')
const UserController = require('../controllers/user')
const isAuth = require('../middleware/is-auth')

const router = express.Router()

router.post('/register', UserController.user_register)

router.post('/login', UserController.user_login)

// router.get('/profile/:id', isAuth, UserController.user_profile)
router.get('/profile', isAuth, UserController.user_profile)

router.post('/logout', UserController.user_logout)


module.exports = router
