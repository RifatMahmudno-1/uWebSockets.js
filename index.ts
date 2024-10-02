import App from './app.js'
import * as dotenv from 'dotenv'

dotenv.config()
const app = App()

app.get('/', (_req, res) => {
	res.send('Hello world!')
})

app.listen(process.env.HOST!, Number(process.env.PORT), () => {
	console.log(`Running on http://${process.env.HOST}:${process.env.PORT}`)
})
