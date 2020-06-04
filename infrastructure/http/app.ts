import {Application, Router} from "https://deno.land/x/denotrain@v0.5.0/mod.ts";

// Create a new application (port defaults to 3000, hostname to 0.0.0.0)
const app = new Application();
// Optional: Generate router and hook routes to it
const router = new Router();

router.get("/", () => {
    // Returning a json
    return {"hello": "world"};
});

app.use('/api', router);

export const startHttpServer = async () => {
    await app.run();
};
