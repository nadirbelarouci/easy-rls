import express, {json, NextFunction, Request, Response} from 'express';
import cors from 'cors';
import OpenAI from "openai";
const app = express();

app.use(cors());
app.use(json());
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ error: "Internal Server Error", details: err.message });
});
const port = 3000;

app.post('/easy-rls/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prompt = req.body.prompt;
    const openai = new OpenAI({ apiKey: req.headers.open_ai_api_key });

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a SQL Engineer Expert" },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    res.send(completion.choices[0].message);
  } catch (error) {
    console.error('Error handling /easy-rls request:', error);
    if (error.response) {
      return res.status(error.response.status).json({ error: error.response.data });
    }
    next(error);
  }
});



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
