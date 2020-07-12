const express = require('express')
const axios = require('axios')
const Wordef = require('../models/wordef')
const User = require('../models/user')

const router = express.Router()
const API_URL = 'https://od-api.oxforddictionaries.com/api/v2/entries/en-gb/'

// this method only runs if the word is NOT in the application database
// function returns object containing all relevant word info in WordDef schema layout,
// or throws error
const fetchWordData = async (word) => {
    let wordObject = {}

    try {
        wordObject = await axios.get(API_URL + word, {
            headers: {
                app_id: process.env.APP_ID,
                app_key: process.env.API_KEY
            }
        })
    } catch (err) {
        console.log(err.message)
        throw new Error('error requesting from database')
    }
    if ('error' in wordObject) {
        console.log(`error from api fetch: ${wordObject.error}`)
        throw new Error('error when fetching word from api')
    }

    // first object in lexicalEntries array contains word definitions and examples
    const wordInfo = wordObject.data.results[0].lexicalEntries[0]
    const definitions = [] // for storing 1+ definitions of a word
    let examplesPerDef = [] // there could be multiple examples for each word definition
    // loop through senses array to populate definitions
    wordInfo.entries[0].senses
        .filter((data) => 'examples' in data) // remove entries with no examples
        .forEach((def) => {
            def.examples.forEach((ex) => examplesPerDef.push(ex.text)) // extract string from object
            definitions.push({
                definition: def.definitions[0],
                examples: [...examplesPerDef]
            })
            examplesPerDef = []
        })

    const part = wordInfo.lexicalCategory.text
    return { word, part, definitions }
}

// adds word to application database for faster future retrieval
// an error in this function does not impact client
const addWordToDB = async ({ word, part, definitions }) => {
    try {
        if (!(word && part && definitions)) {
            throw new Error('can not add word to database')
        }
        const wordDef = new Wordef({
            word,
            part,
            definitions
        })
        await wordDef.save()
        return true
    } catch (error) {
        console.error(error.message)
        return false
    }
}

exports.define_word = async (req, res) => {
    let { word } = req.query
    if (!word) {
        return res.status(400).json({ error: { message: 'no word to search' } })
    }
    // check mongo if word is already stored
    word = word.toLowerCase()
    try {
        const wordQuery = await Wordef.findOne({ word }) // returns null if no matches
        // return full word object if found in mongo
        if (wordQuery) {
            const { part, definitions } = wordQuery
            return res.status(200).json({
                word,
                part: part.toLowerCase(),
                definitions
            })
        }

        // ----------- word not found in mongodb, therefore query api...
        const wordInfo = await fetchWordData(word)
        // store reference in DB
        if (wordInfo) {
            // TODO: remove console logs
            console.log('adding word to  mongo')
            console.log(addWordToDB(wordInfo))
            return res.status(200).json(wordInfo)
        }

        return res.status(400).json({
            error: {
                message: 'error in lookup likely caused by non-word input'
            }
        })
    } catch (error) {
        return res.status(400).json({ error: { message: error.message } })
    }
}

// precondition: word was searched previously and therefore inside the application db
// this may cause error in cases where word was not successfully saved in db
// precondition: user id is attached to request object
exports.add_word_to_cart =  async (req, res) => {
    let { word } = req.body // TODO: this may cause error
    if (!word) { 
        return res.status(400).json({ error: { message: 'no word entered' } })
    }
    word = word.toLowerCase()
    try {
        const user = await User.findOne({ _id: req.userId }).exec()
        if (!user) {
            console.log("can't find user in mongo for some reason")
            return res
                .status(500)
                .json({ error: { message: 'unable to find user' } })
        }
        // find mongoose word object
        const wordObj = await Wordef.findOne({ word })
        // console.log("return from mongo: ", wordObj);
        if (!wordObj) {
            return res
                .status(500)
                .json({ error: { message: "can't find word in db" } })
        }
        user.addToCart(wordObj._id)
        return res.status(200).json(wordObj)
    } catch (err) {
        console.log(err)
        res.status(500).json({
            error: {
                message: err.message,
                detail: 'oops... something went wrong'
            }
        })
    }
}

// precondition: user id is attached to request object
exports.remove_word = async (req, res) => {
    const { wordId } = req.body
    if (!wordId) { 
        return res.status(400).json({ error: { message: 'no word entered' } })
    }
    try {
        const user = await User.findOne({ _id: req.userId }).exec()
        if (!user) {
            return res.status(400).json({
                error: { message: 'unable to find user profile on delete' }
            })
        }
        user.removeFromCart(wordId)
        return res.status(200).json({ message: 'success' })
    } catch (err) {
        res.status(500).json({
            error: {
                message: err.message,
                detail: 'oops... something went wrong'
            }
        })
    }
}

// precondition: user id is attached to request object
exports.empty_cart = async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.userId }).exec()
        if (!user) {
            return res
                .status(500)
                .json({ error: { message: 'unable to find user profile' } })
        }
        user.emptyCart()
        return res.status(200).json({ message: 'success' })
    } catch (err) {
        res.status(500).json({
            error: {
                message: err.message,
                detail: 'oops... something went wrong'
            }
        })
    }
}

module.exports = router
