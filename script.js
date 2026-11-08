/*-- Registration page: ---*/
const registerForm = document.querySelector("#register-form");
const usernameInput = document.querySelector("#username");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const confirmPasswordInput = document.querySelector("#confirm-password");
const registerMessage = document.querySelector("#register-message");

if (registerForm) {
  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const role = document.querySelector('input[name="userType"]:checked');
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const errors = [];

    if (!role) {
      errors.push("Choose Pet Owner or Care Provider.");
    }
    if (username.length < 3) {
      errors.push("Username must be at least 3 characters.");
    }

    if (email === "" || !emailInput.validity.valid) {
      errors.push("Enter a valid email address.");
    }

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters.");
    }

    if (password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }
    if (errors.length > 0) {
      registerMessage.textContent = errors.join("\n");
      return;
    }

    registerMessage.textContent = "All fields passed front-end validation.";
  });
}
/*----------- X -----------*/

/*-- Login page: ---*/
const loginForm = document.querySelector("#login-form");
const loginUsername = document.querySelector("#username");
const loginPassword = document.querySelector("#password");
const loginMessage = document.querySelector("#login-message");

if (loginForm) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const errors = [];
    if (loginUsername.value.trim() === "") {
      errors.push("Enter your username.");
    }

    if (loginPassword.value === "") {
      errors.push("Enter your password.");
    }

    if (errors.length > 0) {
      loginMessage.textContent = errors.join("\n");
    } else {
      loginMessage.textContent = "Both fields are filled in.";
    }
  });
}
/*----------- X -----------*/

/*-- Create request page: ---*/
const requestForm = document.querySelector("#create-request-form");
const petInput = document.querySelector("#pet");
const serviceInput = document.querySelector("#service");
const startTimeInput = document.querySelector("#start-time");
const endTimeInput = document.querySelector("#end-time");
const budgetInput = document.querySelector("#budget");
const deadlineInput = document.querySelector("#deadline");
const requestMessage = document.querySelector("#request-message");

if (requestForm) {
  requestForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const startTime = new Date(startTimeInput.value);
    const endTime = new Date(endTimeInput.value);
    const deadline = new Date(deadlineInput.value);
    const errors = [];

    if (petInput.value === "") {
      errors.push("Choose a pet.");
    }

    if (serviceInput.value === "") {
      errors.push("Choose a service.");
    }

    if (startTimeInput.value === "") {
      errors.push("Enter when the service starts.");
    }

    if (endTimeInput.value === "") {
      errors.push("Enter when the service ends.");
    } else if (startTimeInput.value && startTime >= endTime) {
      errors.push("The end time must be after the start time.");
    }

    if (budgetInput.value === "" || Number(budgetInput.value) <= 0) {
      errors.push("Enter a budget greater than zero.");
    }

    if (deadlineInput.value === "") {
      errors.push("Choose a bidding deadline.");
    } else {
      if (deadline <= new Date()) {
        errors.push("The bidding deadline must be in the future.");
      }

      if (startTimeInput.value && deadline >= startTime) {
        errors.push("The bidding deadline must be before the service starts.");
      }
    }

    if (errors.length > 0) {
      requestMessage.textContent = errors.join("\n");
    } else {
      requestMessage.textContent = "All request fields passed validation.";
    }
  });
}

/*-- Pet profile page: ---*/
const petForm = document.querySelector("#pet-form");
const petNameInput = document.querySelector("#pet-name");
const petTypeInput = document.querySelector("#pet-type");
const petBreedInput = document.querySelector("#pet-breed");
const petAgeInput = document.querySelector("#pet-age");
const petPhotoInput = document.querySelector("#pet-photo");
const petMessage = document.querySelector("#pet-message");

if (petForm) {
  petForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const errors = [];

    if (petNameInput.value.trim().length < 2) {
      errors.push("Enter a pet name with at least 2 characters.");
    }

    if (petTypeInput.value === "") {
      errors.push("Choose a type of pet.");
    }

    if (petBreedInput.value.trim() === "") {
      errors.push("Enter the pet's breed.");
    }

    if (
      petAgeInput.value === "" ||
      Number(petAgeInput.value) < 0 ||
      !Number.isInteger(Number(petAgeInput.value))
    ) {
      errors.push("Enter the pet's age as a whole number of 0 or more.");
    }

    if (petPhotoInput.value.trim() === "" || !petPhotoInput.validity.valid) {
      errors.push("Enter a valid photo URL.");
    }

    if (errors.length > 0) {
      petMessage.textContent = errors.join("\n");
    } else {
      petMessage.textContent = "Pet details passed front-end validation.";
    }
  });
}
/*----------- X -----------*/

/*-- Request details page (bid): ---*/
const bidForm = document.querySelector("#bid-form");
const bidPriceInput = document.querySelector("#bid-price");
const bidDescriptionInput = document.querySelector("#bid-description");
const bidMessage = document.querySelector("#bid-message");

if (bidForm) {
  bidForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const bidPrice = Number(bidPriceInput.value);
    const bidDescription = bidDescriptionInput.value.trim();
    const errors = [];

    if (
      bidPriceInput.value === "" ||
      !Number.isFinite(bidPrice) ||
      bidPrice <= 0
    ) {
      errors.push("Enter a bid price greater than zero.");
    }

    if (bidDescription.length < 10) {
      errors.push("Describe your service in at least 10 characters.");
    }

    if (errors.length > 0) {
      bidMessage.textContent = errors.join("\n");
    } else {
      bidMessage.textContent = "Bid details passed front-end validation.";
    }
  });
}
/*----------- X -----------*/

/*-- Request details page: ---*/
const requestDetailsCard = document.querySelector("#request-details-card");
const requestLoadMessage = document.querySelector("#request-load-message");
const requestPetText = document.querySelector("#request-pet");
const requestServiceText = document.querySelector("#request-service");
const requestStartText = document.querySelector("#request-start");
const requestEndText = document.querySelector("#request-end");
const requestBudgetText = document.querySelector("#request-budget");
const requestDeadlineText = document.querySelector("#request-deadline");
const requestInstructionsText = document.querySelector("#request-instructions");

const sampleRequest = {
  pet: "Cloud - Cat",
  service: "Pe walking",
  start: "2026-11-12T09:00:00",
  end: "2026-11-12T10:00:00",
  budget: 120,
  deadline: "2026-11-10T18:00:00",
  instructions:
    "Cloud is very allergic to earth fire water and air. Please utmost care or we will take legal action!!",
};

if (requestDetailsCard) {
  requestPetText.textContent = sampleRequest.pet;
  requestServiceText.textContent = sampleRequest.service;
  requestStartText.textContent = new Date(sampleRequest.start).toLocaleString();
  requestEndText.textContent = new Date(sampleRequest.end).toLocaleString();
  requestBudgetText.textContent = "AED " + sampleRequest.budget;
  requestDeadlineText.textContent = new Date(
    sampleRequest.deadline,
  ).toLocaleString();
  requestInstructionsText.textContent = sampleRequest.instructions;
}
/*----------- X -----------*/
