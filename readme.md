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

### What does this graph look like?
A potential graph may look somewhat like this:

StartNode -> FetchEPS -> BuyIf (EPS > n) -> CumulativeOutput

Here are some simple explanations to help you understand:

**StartNode:** Marks the beginning of the strategy. *Necessary* (we don't want 7 strategies on one graph!)

**FetchEPS:** Enter the ticker on this node and it will return the EPS.

**BuyIf:** Allows you select (and add multiple) which nodes should be used for conditions. After selecting a node in the drop-down, its conditions will show up. For this example, an EPS value greather than n is selected and n can be set to a number.

**CumulativeOutput** Marks the end of the strategy and allows you to view the cumulative returns across all passes through the strategy. *Necessary*

**Note:** Other Outputs may be used. For instance, the general Output can be used. Afterwards, AlertNodes may be set based on a condition of an output variable. This is primarily for exporting to **Pine Script**, as TradingView supports alerts. It is important to note than when alert conditions are satisfied, it pauses the execution of the strategy in the SEND node editor until the user continues.

## Learning Modules
Learning modules are implemented to both teach how to use the node editor and different stock metrics to create functional and perfomative strategies. These modules are interactive, requiring some reading and some practice within the same page. You cannot access all of the information in a module without successfully completing the practice.

Modules are intended to be completed in a specific order, but it is not mandatory. We realize everyone has differences in their current knowledge and starting points. All modules will be unlocked immedietly upon account creation.

These modules are intended to be broad and intesive, however, time intensive to write. To combat this, information will be manually collected and referenced by AI to generate the readings for these modules. The sources for the information used in each module will be present at the bottom of its page.

# How we built it

# Challenges we ran into

# Accomplishments that we're proud of

# What we learned

# What's next for SEND

## Learning Modules

We have many things planned for the Learning Modules, including:

    1. All modules reviewed and, if needed, edited to be more accurate by industry professionals
    2. Expanding the library of modules and cover more advanced topics
    3. New modules created entirely by industry professionals
    4. Support for new external connections