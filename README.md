# AgriDrone GCS
<img width="120" height="" alt="image" src="https://github.com/user-attachments/assets/79d35a84-2711-4989-9215-1b5c0dafd018" />

This project is built for Transfinitte '25 - Problem Statement by ZeroWings company.
This README explains our project entirely. Please bare with me.

> This README has images and videos. Please make sure you have good internet connection.

## Table of Contents
- [Objective](#objective)
- [Functional Demonstration Videos](#functional-demonstration-videos)
- [User Workflow](#user-workflow)
- [Solution Explanation](#solution-explaination)
- [AI/ML Use Cases](#aiml-use-cases)
  - [Weed Detection](#weed-detection)
  - [Crop Disease Detection](#crop-disease-detection)
  - [Yield Prediction](#yield-prediction)
- [Running Locally](#running-locally)
  - [Server (Express.js backend)](#server-expressjs-backend)
  - [Client (Vite frontend)](#client-vite-frontend)
  - [AI API Service (Python Flask API)](#ai-api-service-python-flask-api)
  - [Drone Simulator (Nodejs-typescript-script-file)](#drone-simulator-nodejs-typescript-script-file)
- [Future Enterprise-Level Improvements](#future-enterprise-level-improvements)
- [Applications of this Technology](#applications-of-this-technology)


# Objective
- Develop a Ground Control Station (GCS) software
that serves as a centralized interface for managing
agricultural drones.
- Farmers should be able to manage field
boundaries through an interactive map-based
interface.
- Simulate drone flight paths for various
agricultural missions such as crop scouting,
pesticide spraying, and yield analysis.
- Integrate AI-driven modules capable of
detecting crop diseases, identifying weed growth,
and estimating crop yield with accuracy.
- Provide real-time telemetry data simulation and
visual feedback, enhancing the user’s situational
awareness and operational control.

# Functional Demonstration Videos
- [GCS Software Demo](https://drive.google.com/file/d/1Ah4FTRQZ4lwZbvqbmMLmGI83oVgj07mk/view?usp=sharing)
- [AI Models Direct Demo](https://drive.google.com/file/d/1L9hH52IYlkLTYhsuxp2aE-_hITkgeFdm/view?usp=sharing)

# User Workflow
This below image is our Workflow basically.
<img width="1443" height="728" alt="Workflow" src="https://github.com/user-attachments/assets/ac8dbffc-ab08-4d46-8e42-c2131e1d6aa9" />

# Solution Explaination
We used a SaaS starter template to get us started with using Vite React for Frontend, Express (+ Socket.io) for Backend and PostgreSQL (supabase) for the database part.

1. Farmers or Admins first login using Email/Password with Email OTP Confirmation (Supabase Auth)
<img width="280" height="" alt="image" src="https://github.com/user-attachments/assets/a1ac44e4-e193-4097-b56c-3af130ca1971" />


2. Dashboard for quick overview of the missions and fields.
<img width="860" height="" alt="Dashboard Overview" src="https://github.com/user-attachments/assets/f9c85170-68bc-4daa-9dac-215e05f7c50c" />


3. Farmers create a _Field_ 
<img width="740" height="778" alt="Field Creation" src="https://github.com/user-attachments/assets/d57714dc-dc1b-4e91-8dd9-e17e1921c225" />


4. Farmers create a mission that is executed on the Field by drawing pathlines
There's a lot of improvements possible here:
- Support for pre-made algorithms for covering whole area (TODO: Research on such algorithms)
- Support Options for One-way or Two-way options, or repeat daily / custom time period feature.
- Support Curved Lines (this is actually completed, its just one-line change)
<img width="600" height="" alt="Mission creation" src="https://github.com/user-attachments/assets/bb81bf8d-1e40-4d23-bba4-67fb4f4c2d60" />


5. Mission Dashboard: Assign a drone that is online currently. State Management of Drones using Web Sockets is perfectly handled.
<img width="740" height="" alt="Missionn Dashboard" style="display:inline;" src="https://github.com/user-attachments/assets/387045aa-252b-4901-a7e3-9545d6e450b0" />
<img width="150" height="" alt="Online Drones" style="display:inline;" src="https://github.com/user-attachments/assets/9a43b37e-6920-4d79-8e6f-21deba1cc65b" />


6. Drone Simulation
A drone simulator is just a NodeJS script that makes a websocket connection the backend and starts communicating with it.
Whenever a drone comes online / goes offline, everything is reactive at the dashboard.
<img width="640" height="403" alt="Telemetry" src="https://github.com/user-attachments/assets/e4a9ccdc-0d1d-4cd2-89d9-479584a23166" />


7. Live Telemetry using Websockets and Progress Calculation. THERE'S ALSO AI/ML Telemetry Processing that gives us Yield Prediction, Disease Identification and Weed Identification. **A seperate section is dedicated to this.**
<img width="717" height="398" alt="Live Motion" src="https://github.com/user-attachments/assets/908104f5-aa68-4bf5-84e4-09322657e85e" />
<img width="424" height="652" alt="Controls and Progress" src="https://github.com/user-attachments/assets/9b00c502-50ec-4323-85b5-a170384d0dcb" />


8. Post-Mission Completion Report Generation.
All the telemetry data (which is generated every 2 seconds and also given the ML models) is stored in a PostgreSQL database batch-wise, and latest few telemtry is stored in memory (Redis) for fast-access.
The data can be made of use to **Generate Meaning Full Reports**. Following is the Schema of the Telemetry data available. 
We didn't have the chance to complete report generation within the given time.
```ts
{
          altitude_meters: number
          battery_percent: number
          id: string
          infection_score: number | null
          latitude: number
          longitude: number
          mission_id: string
          progress: number | null
          speed_ms: number
          temperature: number | null
          timestamp: string | null
          weed_score: number | null
          yield_score: number | null
}
```

# AI/ML Use Cases

## Weed Detection
- Masking, Segmentation, Miou Calculation, Fine Tuning Unet
- Optimizer - Adam (with scheduler)
- loss_fn -BCE + Dice loss
 
<img width="800" height="" alt="image" src="https://github.com/user-attachments/assets/81e3f22e-75b2-43e1-a305-39dbe0ada1a3" />

Basically to train our model we’ve got the ground
truth values where weeds reside, and we train our
model to continually predict the image optimizing
the loss function.
But during validation we use something called
**Intersection over Union**(IoU) that basically gives us the
overlap percentage of ground truths and our
predictions and optimizes our model.


## Crop Disease Detection
- Efficientnet_b0 finetuning
- Cleaning of datasets
- Binary Classification
- loss_fn - BCE with logits loss

## Yield Prediction
- Decision Trees & Logic Regression
- Canopy features
- Environment AI features

<img width="400" height="" alt="image" src="https://github.com/user-attachments/assets/03941583-c73b-4cb2-a61b-4ec6cdeae319" />

We use the same weed prediction dataset but apply green-value masking to get total vegetative cover. Subtracting weed cover gives crop cover. Since the dataset lacks yield data and the regression dataset lacks imagery, direct combination isn’t feasible. We estimate yield from canopy features, train a regression model on environmental data, then reapply it with canopy features. The two yield estimates are combined via weighted averaging for a balanced approximation.

## Running Locally
There are three services namely
### Server (Express.js backend)
Inside `/server`, copy .env.example into .env and run `pnpm run dev` to start the server. Also setup Supabase (Dockerized approach or Cloud instance). 
### Client (Vite frontend)
Inside `/client`, copy .env.example into .env and run `pnpm run dev` to start the client.
### AI API Service (Python Flask API)
Images and models would be missing in this github repo due to file size limitations. Please visit the [Functional Demonstration Videos](#functional-demonstration-videos) for the AI models.
Inside `/ai-api`,
- run `pip install -r requirements.txt`
- run `python server.py` for running the api service
### Drone Simulator (Node.js Typescript script file)
- run `pnpm run dev:drone [drone-id]`

## Future Enterprise-Level Improvements
1. Multiple drones per mission & fleet monitoring and also mission re-scheduling feature
2. Proper AI-aided Report Generation based on the collected telemetry and alerts
3. Introduce heatmaps & 3D visualizations for AI results over time
4. Introduce pre-made algorithm suggestions for drawing drone pathlines
5. Integration with IoT for soil, weather monitoring
6. Scalable Backend and Queue Implementation for handling enterprise-level load
7. Cloud-ready development, dockerize the entire application for easy deployment
8. Security improvements for server <-> dashboard and server <-> drone communication

## Applications of this Technology
- Detect diseases, pest infections, and nutrient deficiencies early.
- Identify and locate weed clusters for targeted removal.
– Predict crop yield using aerial imagery and AI analysis.
– Automate fertilizer and pesticide spraying with high accuracy.
– Generate accurate field boundaries, elevation maps, and 3D terrain models.
– Integrate with sensors to monitor soil condition and irrigation needs.
- Schedule and execute drone flights for multiple fields autonomously.
– Provide actionable insights for planting, irrigation, and harvesting.
– Visualize crop growth and performance over time with heatmaps.
– Optimize resource use, reduce chemical wastage, and increase overall farm efficiency.

Thank you for reading this far.
Made with ❤️ by Team `>Binapple!` for Transfinitte '25
