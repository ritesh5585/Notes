import app from "./src/app.js"
import morgan from "morgan"

app.use(morgan("dev"))

app.listen(3000, () => {
    console.log("port running on 3000")
})