import express from "express"

const app = express()

app.get("/api/health", (req, res) => {
    res.status(200).json({
        message: "okk"
    })
})

app.get("/api/hello", (req, res) => {
    res.status(200).json({
        message: "Hello World"
    })
})

app.get("/api/user", (req, res) => {
    const users = [
        { id: 1, name: "Ritesh" },
        { id: 2, name: "Gouri" },
        { id: 3, name: "Girija" }
    ];
    res.status(200).json(users)
})

export default app