function Component()
{
}

Component.prototype.createOperations = function()
{
    component.createOperations();
};

Component.prototype.createOperationsForArchive = function(archive)
{
    component.addOperation("Extract", archive, "@WAKFU_PLUGINS@");
};