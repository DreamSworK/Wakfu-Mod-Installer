function Component()
{
    var componentName = component.name;
    if (systemInfo.kernelType === "winnt") {
        componentName = componentName + ".windows";
    } else if (systemInfo.kernelType === "darwin") {
        componentName = componentName + ".osx";
    } else if (systemInfo.kernelType === "linux") {
        componentName = componentName + ".linux";
        if (systemInfo.currentCpuArchitecture === "i386") {
            componentName = componentName + ".i386";
        } else if (systemInfo.currentCpuArchitecture === "x86_64") {
            componentName = componentName + ".x86_64";
        }
    }
    installer.componentByName(componentName).setValue("Virtual", "false");
    installer.componentByName(componentName).setValue("Default", "true");
}