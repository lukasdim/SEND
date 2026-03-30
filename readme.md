# Inspiration
## Initial Idea

Initially, this node-based idea came from **Hytale**, a block-based game similar to **Minecraft** with extensive modding support in java. Hytale has a node editor to completely customize the terrain, from making new biomes to floating islands.

This extensive support through a node-based editor was extremely intriguing and my brainstorming for Hackonomics kept leading me back to that aspect.

## Economics and Stocks

I loved learning about and trading stocks, so I decided to go that route. However, with services aimed at teaching stock trading, I find that it's difficult to process the information. I never knew what metrics to focus on for a stock. At one point I learned that the beta value of a stock is its relative volatility and conveys possible risk, but to what extent does that affect my investment? I never knew the answer, and it's hard to view the effects of these metrics in isolation.

## Later Expansion

While a sandbox-style editor is vital to the project, I realized it wasn't very strong at addressing financial literacy; it only addressed practicing previously learned knowledge. So, I transitioned into a modules based approach where users can complete interactive lessons while also having access to the sandbox for practice.

## Real-World Use

Instead of just being a learning platform, we are looking into ways to export this information to external services or languages **(Pine Script by TradingView)**. This way, users can use their trading strategies with real money if they deem it worthwile.

**NOTE: We do not advise on individual investments nor if users should export their graphs. Trade with real money at your own risk.**

# What it does
## Node-Based Editor
The entire focus of this project is its node-based editor. There are hundreds of nodes, which can fetch and return information, xxx, perform buys and sells (or longs and shorts) based on conditions, and much more. These nodes can then be combined to create a trading strategy **(graph)** for a stock.

**CumulativeOutput** Marks the end of the strategy and allows you to view the cumulative returns across all passes through the strategy. *Necessary*

**Note:** Other Outputs may be used. For instance, the general Output can be used. Afterwards, AlertNodes may be set based on a condition of an output variable. This is primarily for exporting to **Pine Script**, as TradingView supports alerts. It is important to note than when alert conditions are satisfied, it pauses the execution of the strategy in the SEND node editor until the user continues.

## Learning Modules
Learning modules are implemented to both teach how to use the node editor and different stock metrics to create functional and perfomative strategies. These modules are interactive, requiring some reading and some practice within the same page. You cannot access all of the information in a module without successfully completing the practice.

Modules are intended to be completed in a specific order, but it is not mandatory. We realize everyone has differences in their current knowledge and starting points. All modules will be unlocked immedietly upon account creation.

These modules are intended to be broad and intesive, however, time intensive to write. To combat this, information will be manually collected and referenced by AI to generate the readings for these modules. The sources for the information used in each module will be present at the bottom of its page.

# Docker runtime notes

- The backend container packages the OCaml worker as a local executable and starts it through `ocaml.worker.command`.
- In Docker Compose, `OCAML_WORKER_COMMAND=/app/worker` is the supported container runtime configuration.
- Outside Docker, the backend may still rely on the existing local source checkout fallback when `ocaml.worker.command` is left empty.
- Docker Compose is the supported local development path for app configuration.
- Export the required environment variables before running `docker compose up --build`: `SEND_DB_PASSWORD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `APP_AUTH_SUPABASE_ISSUER_URI`, `APP_AUTH_SUPABASE_JWK_SET_URI` or `APP_AUTH_SUPABASE_JWT_SECRET`, `APP_LECTURES_PROGRESS_COOKIE_SECRET`, and optionally `APP_AUTH_SUPABASE_AUDIENCE`.
- The frontend now talks to the backend through the bundled Nginx reverse proxy at the same origin, so `VITE_API_URL` should normally be left empty in Docker Compose.
- Supabase projects using legacy `HS256` signing should set `APP_AUTH_SUPABASE_JWT_SECRET` and may leave `APP_AUTH_SUPABASE_JWK_SET_URI` empty. Projects using asymmetric signing should keep `APP_AUTH_SUPABASE_JWK_SET_URI` set and leave `APP_AUTH_SUPABASE_JWT_SECRET` empty.
- Only the frontend is published to the host, and it is bound to `127.0.0.1:5173` by default. The backend and database stay on an internal Docker network.
- If you are fronting the stack with `cloudflared`, point the tunnel at `http://localhost:5173` on the host or at the `send-front` service inside the Docker network. Do not publish the backend or database directly.
- The frontend proxy only trusts `CF-Connecting-IP` when the immediate peer is a local or private-network proxy. That is intended for the `cloudflared -> localhost/private Docker` path; if you later expose the frontend directly or change the proxy chain, revisit `frontend/nginx.conf`.
- Plain `npm run dev` and local backend runs are unsupported-by-default unless you manually export the same variables outside Docker.

# How we built it

Initially, we used react for the frontend and java for the backend api and strategy controller. After attempting to do node exeuction and processing in java, we realized it would be better if we had an OCaml-styled type system, so we implemented OCaml. We started by building the sandbox first, as that was the core behind our tool. We continually added more and more features and then eventually added lectures.

We also converted this into a docker-runnable container. That way, people can clone the files and easily run our tool on their own.

If you want to see more specifics on the system, github has a lot more information.

# Challenges we ran into

We struggled on creating the execution agent at first. It was primarily going to be in java, so a lot of work was made in java that now doesn't exist because it was inefficient.

It was also quite difficult to determine what features would be difficult for users to use.

There was a bit of trouble with cloudflare and docker as well. We initially had trouble mapping the correct ip and port to cloudflared (my app (my computer) -> cloudflared (my computer) -> cloudflare (the internet)), which was later resolved. Then, we had issues with cloudflare DNS and cloudflared tunneling (again, an app on my computer). Later, we had issues with cloudflare access permissions that we solved.

There were many more issues that were smaller. With the scale of this project, there were bound to be many large issues. Importantly, we were able to solve and learn from them.


# Accomplishments that we're proud of

Primarily, we're proud that we were able to (almost) entirely host, build, and design this project entirely on our own. Our service only connects to supabase for user authentication. Everything else was built by us and we are hosting it on our own equipment routed through cloudflare tunnel. This is a huge accomplishment, as we don't need to pay a service to keep our site online.

We're also proud that we made a working environment that can represent a person's investment routine and portfolio.

# What we learned

Through this project, we were able to learn a lot about industry-used tools and concepts, like cloudflare for DNS proxying, docker for containerized and secure app deployment, proper git and github usage and documentation, spring for java services, connecting apps via stdin and stdout, and much, much more.

# What's next for SEND

## Learning Modules

We have many things planned for the Learning Modules, including:

    1. All modules reviewed and, if needed, edited to be more accurate by industry professionals
    2. Expanding the library of modules and cover more advanced topics
    3. New modules created entirely by industry professionals
    4. Support for new external connections

## Sandbox

- Export to pine script!
    - Pine Script is a scripting language used by TradingView. It is used for stock analysis with live stock data.
- More derived nodes
- Integrate AI to allow for personalized feedback on strategies, explanations of strategies, and recommendations.
- Helpful walkthroughs/tours on first visit
- Easier to use for beginners

## Derived Nodes "Marketplace"

- Planning to allow users to make their own derived nodes for their own use.
- Users can then upload a derived node to the marketplace to share what they habe created.
- Other users can add uploaded derived nodes to their own library to use