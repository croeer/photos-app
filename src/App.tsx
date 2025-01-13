import React from "react";
import logo from "./logo.svg";
import PhotoUpload from "./components/PhotoUpload";
import PhotoGallery from "./components/PhotoGallery";

function App() {
  return (
    <div className="App">
      <div className="mt-10 mb-10 flex justify-center">
        <img src={logo} alt="" />
      </div>
      <div className="mt-10 mb-10 flex justify-center">
        <PhotoUpload
          url={"https://o1xlh7o7c5.execute-api.eu-central-1.amazonaws.com"}
          maxPhotosPerRequest={10}
          onUpload={() => {
            window.location.reload();
          }}
        />
      </div>
      <PhotoGallery
        initialUrl={"https://o1xlh7o7c5.execute-api.eu-central-1.amazonaws.com"}
      />
    </div>
  );
}

export default App;
