import React from "react";
export const Button = (props) =>
  React.createElement("button", props, props.title);
export const Panel = (props) =>
  React.createElement("panel", props, props.children);
export const Icon = (props) => React.createElement("icon", props);
export const useUI = () => ({
  colors: { green: "#00ff00", red: "#ff0000" },
  styles: {},
});
