const express = require('express')
const WordsController = require('../controllers/words')
const isAuth = require('../middleware/is-auth')

const router = express.Router()

router.post('/addWordToCart', isAuth, WordsController.add_word_to_cart)

router.get('/define', WordsController.define_word)

router.post('/removeWord', isAuth, WordsController.remove_word)

router.post('/emptyCart', isAuth, WordsController.empty_cart)

module.exports = router
