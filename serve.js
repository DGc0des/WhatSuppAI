const express = require('express');
const app = express();

//route 

app.get('/', (req, res) => {
    res.send('WhatSuppAI is running');
});


app.listen(3000, () => {
    console.log('WhatSuppAI is running on port 3000');
});