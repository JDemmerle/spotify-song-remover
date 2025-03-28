# ToDos

- Update deprecated modules. For example request.
- Find out why helmet does not work or just set https://helmetjs.github.io/faq/you-might-not-need-helmet/
- Show the current song inside the "remove from playlist" button
- Add something like the following for better debugging
```
app.listen(PORT, function(err){
    if (err) console.log("Error in server setup")
    console.log("Server listening on Port", PORT);
})
```