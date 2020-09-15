$( document ).ready(function() {
    G.modelsSidebar = new ModelsSidebar("");
});

const MAX_SIDEBAR_WIDTH = 500;
const MIN_SIDEBAR_WIDTH = 20;

class ModelsSidebar {
	constructor(selected) {
		this.showSelected = this.showSelected.bind(this);
		this.selectedPath = selected;
		this.resizing = false;
        
        let sideBarWidth =  G.settingsManager.getSetting('sidebarWidth');
        $(':root').css('--sidebar-left-width',  sideBarWidth + 'px'); //size to last saved width
		
		this.buildSideBar();
		this.enableSideBarResize();
		this.enbableModelDragDrop();
	}

	enableSideBarResize() {
		function resizeHandler(event) {
			if (event.pageX >= MIN_SIDEBAR_WIDTH && event.pageX <= MAX_SIDEBAR_WIDTH) {
				// Because of the magic of CSS variables, all we have to do is update the sidebar-left-width
				// Check the calculations in main.css to see how everything else is calculated based on this.
//				const html = document.getElementsByTagName('html')[0];
//				html.style.cssText = `--sidebar-left-width: ${event.pageX}px`;
                $(':root').css('--sidebar-left-width',  event.pageX + 'px');
                G.settingsManager.setSetting('sidebarWidth', event.pageX); //set from saved settings
			}
		}

		// On mousedown on the spacer, set indicator that we are resizing the sidebar and bind the resizing handler.
		$('#sidebar_spacer').on('mousedown', function() {
			G.modelsSidebar.resizing = true;
			$(document).on('mousemove', resizeHandler);
		})

		// Mouseup could happen anywhere, so check that on the document.
		// If there's a mouseup and we're resizing, stop the resizing handler.
		$(document).on('mouseup', function() {
			if (G.modelsSidebar.resizing) {
				G.qutterManager.updateMarkers();
				G.modelsSidebar.resizing = false;
				$(document).off('mousemove', resizeHandler);
			}
		})
	}

	enbableModelDragDrop() {
		$('.directory_label').on('dragover', function(event) {
			event.preventDefault();
			event.stopPropagation();
			$(this).addClass('dragging');
		})

		$('.directory_label').on('dragleave', function(event) {
			event.preventDefault();
			event.stopPropagation();
			$(this).removeClass('dragging');
		})

		$('.directory_label').on('drop', function(event) {
			event.preventDefault();
			event.stopPropagation();
			$(this).removeClass('dragging');

			// Make sure there is data and a model is being dropped.
			const textData = event.originalEvent.dataTransfer.getData("text");
			if (textData) {
				const droppedData = JSON.parse(textData);
				if (droppedData.type && droppedData.type === 'model-file') {
					const newFilePath = G.modelsManager.moveModel(droppedData.fullPath, $(this).data('path'));

					// It's possible to drop a file on the directory it's already in.
					// So only do stuff if the file was moved to a new directory.
					if (newFilePath !== droppedData.fullPath) {
						// If we moved the currently selected model, we need to update selectedPath.
						if (droppedData.fullPath === G.modelsSidebar.selectedPath) {
							G.modelsSidebar.selectedPath = newFilePath;
						}
						
						// Easiest thing to do after moving is to just rebuild the sidebar.
						// This will make sure the moved file gets put in the right place.
						G.modelsSidebar.buildSideBar();
						
						// Then we also need to re-enable drag and drop on the rebuilt sidebar.
						G.modelsSidebar.enbableModelDragDrop();
					}
				}
			}
		})

		$('.model_label').on('dragstart', function(event) {
			const fullPath = $(this).parent().data('path');
			event.originalEvent.dataTransfer.effectAllowed = 'move';
			// Store the path and type of thing being dragged.
			event.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
				type: 'model-file',
				fullPath,
			}));
		});

	}
		
	buildSideBar() {
		const rightArrow = "&#9654;"
		const downArrow = "&#9660;"

		$( '#sidebar_left' ).empty();
		
		let modelPaths = G.modelsManager.paths; //{directory, directoryPath, files:[{file, filePath}]}
		for (var i = 0; i < modelPaths.length; i++) {
			let models = modelPaths[i];

			let directoryButton = "<div></div>"
			if (models.directory !== "") {
				directoryButton = "<div class='button'><div class='arrow'>" + downArrow + "</div></div>";
			}

			$( '#sidebar_left' ).append(
				"<div class='directory_label' data-open='true' data-path='" + models.directoryPath + "'>" + 
					directoryButton +
					"<div class='label'>" + models.directory + "</div>" +
				"</div>"
			);

			// Build a directory_group to contain all files within this directory. Makes slideUp and slideDown possible.
			const directoryGroup = $(`<div class="directory_group" data-path="${models.directoryPath}"></div>`);
			$( '#sidebar_left' ).append(directoryGroup)
			
			for (var j = 0; j < models.files.length; j++) {
				let file = models.files[j];
				
				var buttonClass = "model_button";
				var pointerDiv = "";
				if (this.selectedPath == file.filePath) {
					buttonClass = "model_button model_button_selected";
					pointerDiv = "<div class='model_pointer'></div>";
				}

				directoryGroup.append(
					"<div class='" + buttonClass + "' data-path='" + file.filePath + "'>" +
						"<div class='model_button_delete' data-marked='x'> </div>" +
						"<div class='model_label' draggable='true'>" + file.file + "</div>" +
						pointerDiv +
					"</div>"
				);

			}
		}

        $( '#sidebar_left' ).append("<div class='empty_directory_label'> </div>"); //just add a little space at the bottom with an empty directory label div

		$(".directory_label .button").click(function(e) {
			const directoryOpen = $(this).parent().data("open");
			const directoryPath = $(this).parent().data("path");

			if (directoryOpen) {
				$(this).parent().data("open", false);
				$(this).html(rightArrow);

				// Find all directory_group divs with this directoryPath and collapse them.
				$(`.directory_group[data-path='${directoryPath}']`).slideUp();

			}
			else {
				$(this).parent().data("open", true);
				$(this).html(downArrow);

				// Find all directory_group divs with this directoryPath and show them.
				$(`.directory_group[data-path='${directoryPath}']`).slideDown();
			}
		});

		// Double click to rename a file.
		$(".model_label").dblclick(function(e) {
			const originalDiv = $(this);

			function doRename(newName) {
				const fullPath = originalDiv.parent().data("path");
				const newFile = G.modelsManager.renameModel(fullPath, newName);
				// Easiest thing to do after renaming is to just rebuild the sidebar.
				// This will make sure the renamed file gets put in the right place.
				G.modelsSidebar.selectedPath = newFile.filePath;
				G.modelsSidebar.buildSideBar();
				G.modelsSidebar.enbableModelDragDrop();
			}

			const nameInput = $("<input>")
				.attr("type", "text")
				.addClass("rename_model")
				.val($(this).text())
				.blur(function () {
					doRename($(this).val());
				})
				.keypress(function (event) {
					if (event.key === "Enter") {
						doRename($(this).val());
					}
				})
		
			originalDiv.hide();
			nameInput.insertAfter(originalDiv);
			nameInput.focus();
		})
		
		//Select model listener
		$(' .model_label ').click(function (e) {
			let path = $(this).parent().data("path");
			if (G.modelsSidebar.selectedPath != path) G.modelsSidebar.showSelected(path); //scope is lost, so just reference Global
		});
		
		//Hover over model and show delete/undo button listener
		$(' .model_button ').hover(function (e) {
			let marked = $( this ).children('.model_button_delete').data("marked");
			$( this ).children('.model_button_delete').text(marked); //this scope change
		}, function (e) {
			$( this ).children('.model_button_delete').text(" "); //this scope change
		});
		
		//Select delete/undo listener
		$(' .model_button_delete ').click(function (e) {
			var marked = $( this ).data("marked");
			if (marked == "x") marked = "u";
			else marked = "x";
					
			if ( $( this ).siblings('.model_label').hasClass('strikethrough') ) {
				$( this ).siblings('.model_label').removeClass('strikethrough');
			} else {
				$( this ).siblings('.model_label').addClass('strikethrough');
			}
			
			$( this ).text(marked);
			$( this ).data("marked", marked);
		});
	}
		
	
	showSelected(selectedPath, loadModel) {
		// Remove model_button_selected and model_pointer from all model buttons.
		$('#sidebar_left .model_button').removeClass('model_button_selected');
		$('#sidebar_left .model_button').find('.model_pointer').remove();

		// Add model_button_selected and model_pointer to the currently selected button.
		$(`#sidebar_left .model_button[data-path='${selectedPath}']`).addClass('model_button_selected');
		$(`#sidebar_left .model_button[data-path='${selectedPath}']`).append("<div class='model_pointer'></div>");

		if (selectedPath != G.modelsManager.selected && !loadModel) {
			G.modelsManager.loadModel(selectedPath);
		}
	}

	
}
