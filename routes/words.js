const express = require("express");
const router = express.Router();
const axios = require("axios");
const Wordef = require("../models/wordef");
const User = require("../models/user");

const API_URL = "https://od-api.oxforddictionaries.com/api/v2/entries/en-gb/";

//this method only runs if the word is NOT in the database
//function returns object containing all relevant word info in WordDef schema layout, or null if no match found
const fetchWordData = async (word) => {
  let wordObject = {};

  try {
    wordObject = await axios.get(API_URL + word, {
      headers: {
        app_id: process.env.APP_ID,
        app_key: process.env.API_KEY,
      },
    });
  } catch (err) {
    console.log("error when fetching word from api");
    return null;
  }
  if ("error" in wordObject) {
    console.log("error when fetching word from api");
    //console.log(wordObject.error);
    return null;
  }

  //first object in lexicalEntries array contains word definitions and examples
  const wordInfo = wordObject.data.results[0].lexicalEntries[0];
  const definitions = []; //for storing 1+ definitions of a word
  let examplesPerDef = []; //there could be multiple examples for each word definition
  //loop through senses array to populate definitions
  wordInfo.entries[0].senses
    .filter((data) => "examples" in data) //remove entries with no examples
    .forEach((def) => {
      //console.log('def is ', def);
      def.examples.forEach((ex) => examplesPerDef.push(ex.text)); //extract string from object

      definitions.push({
        definition: def.definitions[0],
        examples: [...examplesPerDef],
      });
      examplesPerDef = [];
    });

  const part = wordInfo.lexicalCategory.text;
  // console.log("successful word retrieval: ", definitions);
  return { word, part, definitions };
};

router.get("/define", async (req, res) => {
  const word = req.query.word;
  if (!word) {
    return res.json("Enter a word");
  }
  //check mongo if word is already stored
  try {
    const wordQuery = await Wordef.findOne({ word }); //returns null if no matches
    //return full word object if found in mongo
    if (wordQuery) {
      const { part, definitions } = wordQuery;
      return res.send({
        word,
        part,
        definitions,
      });
    }

    //word not found in mongodb, therefore query api...
    const wordInfo = await fetchWordData(word);

    //store reference in DB
    if (wordInfo) {
      await addWordToDB(wordInfo);
    } else {
      console.log("error in api lookup: likely caused by non-word input");
      res.status(400).send();
    }
    return res.json(wordInfo);
  } catch (error) {
    //console.error(error);
    console.log("error in api lookup: likely caused by non-word input");
    res.status(400).send();
  }
});

const addWordToDB = ({ word, part, definitions }) => {
  try {
    const wordDef = new Wordef({
      word,
      part,
      definitions,
    });
    wordDef.save().then((result) => {
      //save() will save to DB
      //		console.log("result from saving word to DB, ", result);
    });
  } catch (error) {
    console.error(error);
  }
};

//precondition: word was searched previously
router.post("/addWordToCart", async (req, res) => {
  if (!req.userId) {
    //this route is only for logged in users
    return res.status(400).json("Authorization denied trying to add word");
  }
  let word = req.body.word;

  word = word.toLowerCase();
  try {
    const user = await User.findOne({ _id: req.userId }).exec();
    if (!user) {
      console.log("can't find user in mongo for some reason");
      return res.status(400).json("unable to find user in addWord route");
    }
    //find mongoose word object
    const wordObj = await Wordef.findOne({ word: word });
    // console.log("return from mongo: ", wordObj);
    if (!wordObj) {
      return res.status(400).send("can't find word in db");
    }
    user.addToCart(wordObj._id);
    return res.json(wordObj);
  } catch (err) {
    console.log(err);
  }
});

router.post("/removeWord", async (req, res) => {
  if (!req.userId) {
    // this case only here as precaution
    //this route is only for logged in users
    return res.status(400).json("Authorization denied trying to add word");
  }

  let wordId = req.body.wordId;
  try {
    const user = await User.findOne({ _id: req.userId }).exec();
    if (!user) {
      return res.status(400).json("unable to find user profile on delete");
    }
    user.removeFromCart(wordId);
    res.status(200).json("success");
  } catch (e) {
    res.status(500).json("oops... something went wrong");
  }
});

router.post("/emptyCart", async (req, res) => {
  if (!req.userId) {
    // this case only here as precaution
    //this route is only for logged in users
    return res.status(400).json("Authorization denied trying to add word");
  }

  try {
    const user = await User.findOne({ _id: req.userId }).exec();
    if (!user) {
      return res
        .status(400)
        .json("unable to find user profile on delete all words");
    }
    user.emptyCart();
    return res.status(200).json("success");
  } catch (e) {
    res.status(500).json("oops... something went wrong");
  }
});

module.exports = router;
