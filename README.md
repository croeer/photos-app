# Photos app

## Ceramics gallery and studio uploads

Customers browse the gallery at the site root. Staff bookmark `/?studio` on the same site, choose **Anmelden**, then select one or more JPEGs. Uploaded photos appear in the public gallery once image processing finishes.

The cs-Arts Terragrunt environment enables `staff_uploads_only = true` and `enable_photoupload = true`. Apply that environment and deploy the matching client build. The stack creates a dedicated Amazon Cognito user pool with administrator-only invitations. In the Cognito console, open the pool identified by the `studio_user_pool_id` Terraform output and create a user with the staff member’s email address and an email invitation. They set their password on first sign-in. Disable their account in the same pool when they leave.

API Gateway requires a staff access token on `POST /api/studio/upload` before the signer can issue S3 upload forms. Gallery reads stay public in the ceramics configuration. Event environments can keep guest uploads by leaving `staff_uploads_only` at its default of `false`. Setting `enable_photoupload = false` disables uploads for everyone.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `yarn test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `yarn eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
