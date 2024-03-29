// keep jslint happy
//var JSON;
//var console,localStorage;

var FileSystem= (function(){
    // used when access is from scripts deployed on computationstructures.org
    var server_url = 'https://mit-6004x.appspot.com';
    var shared_url = 'http://computationstructures.org/labs';

    // used when access is from scripts deployed on localhost
    var local_server_url = 'http://localhost:6004';
    var local_shared_url = 'http://localhost/6.004x/server';

    // used when access is from scripts deployed on 6004.mit.edu
    var mit_server_url = 'https://6004.mit.edu/coursewarex/cgibin_file_server.py';
    var mit_shared_url = 'https://6004.mit.edu/coursewarex';

    var saved_file_list = [];
    var saved_folder_list = [];

    function server_request(url,data,callback) {
        // we support various servers during development
        var host = $(location).attr('host');
        if (host == 'localhost') {
            url = local_server_url + url;
        }
        else if (host == '6004.mit.edu') {
            data['_path'] = url;   // add path info to request data
            url = mit_server_url; // cgi bin script
        }
        else {
            url = server_url;
        }

        // now make the request
        $.ajax(url, {
            type: 'POST',
            dataType: 'json',
            data: data,
            xhrFields: {
                // hopefully there's a session cookie :)
                withCredentials: true
            },
            success: function(response) {
                if (callback) callback(response);
            },
            error: function(jqXHR,status,error) {
                // provide error as a json response
                if (callback) callback({_error: 'Server '+status+' '+error});
            }
        });
    }

    function shared_request(url,dataType,succeed,fail) {
        var host = $(location).attr('host');
        if (host == 'localhost') host = local_shared_url;
        else if (host == '6004.mit.edu') host = mit_shared_url;
        else host = shared_url;

        $.ajax(host+url, {
            type: 'GET',
            dataType: dataType,
            success: function(response) {
                succeed(response);
            },
            error: function(jqXHR,status,error) {
                if (fail) fail('Server '+status+' '+error);
            }
        });
    }

    // figure out who user is and let callback know
    function validate_user(callback) {
        // if user has already signed in, life is easy
        var user = sessionStorage.getItem('user');
        if (user) {
            callback(user);
            return;
        }

        if ($(location).attr('host') == '6004.mit.edu') {
            // server will use certificate to determine who user is
            server_request('/user/validate',{},
                           function (response) {
                               if (response._error === undefined) {
                                   sessionStorage.setItem('user',response._user);
                                   callback(response._user);
                               }
                           });
            return;
        }

        function complete_signin(dialog) {
            var user = dialog.inputContent(0);
            var password = dialog.inputContent(1);

            // a successful validation will set a session cookie that will
            // passed to the server on subsequent ajax calls.
            server_request('/user/validate',
                           {'_user': user,'_password': password},
                           function (response) {
                               if (response._error === undefined) {
                                   dialog.dismiss();
                                   if (response._user) user = response._user;
                                   sessionStorage.setItem('user',user);
                                   callback(user);
                               } else {
                                   dialog.showError(response._error);
                                   // leave dialog show and let user try again
                               }
                           });
        }

        // pop up dialog to let user sign in
        var dialog = new ModalDialog();
        dialog.setTitle("Sign In");
        dialog.inputBox({label: "Email", type: 'email', callback: complete_signin});
        dialog.inputBox({label: "Password", type: 'password', callback: complete_signin});
        dialog.addButton("Dismiss", "dismiss");
        dialog.addButton("Submit", function(){complete_signin(dialog);}, 'btn-primary');
        dialog.show();
    }

    // build required tree from list of filenames
    function build_tree(flist,root_name) {
        var root = {name: root_name || '???', path: '', folders: {}, files: {}};

        flist.sort();  // keep names in order
        $.each(flist,function (index,fname) {
            // current folder starts at the root
            var dir = root;

            // process each component of hierarchical file name, creating any missing
            // directories as we descend from the root.  Last component is the file name...
            var components = fname.split("/");
            $.each(components,function (nindex,name) {
                if (nindex == components.length - 1) {
                    if (name.length > 0) {
                        // last component is the file name, add to current folder
                        dir.files[name] = {name: name, path: (dir.path != '') ? dir.path+'/'+ name : name};
                    }
                } else {
                    // see if already have a (sub)folder of this name
                    var child = dir.folders[name];
                    if (child === undefined) {
                        // if not create a new folder, save in parent
                        child = {name: name, path: (dir.path != '') ? dir.path+'/'+name : name, folders: {}, files: {}};
                        dir.folders[name] = child;
                        saved_folder_list.push(child.path);
                    }
                    // descend a level in the folder tree
                    dir = child;
                }
            });
            
        });

        return root;
    }

    function getFileList(succeed,fail) {
        // first step: validate the user with the server
        validate_user(function(user) {
            server_request('/file/',
                           {'action': 'list'},
                           function (response) {
                               if (response._error === undefined) {
                                   saved_file_list = response.list;  // remember for later reference
                                   var tree = build_tree(response.list);
                                   succeed(tree,sessionStorage.getItem('user'));
                               } else {
                                   if (fail) fail(response._error);
                               }
                           });

        });
    }

    function getSharedFileList(succeed,fail) {
        shared_request('/shared.json','json',
                       function(response) { succeed(build_tree(response.list,'shared')); },fail);
    }

    function getUserName() {
        return sessionStorage.getItem('user');
    }

    function isFolder(filename) {
        return saved_folder_list.indexOf(filename) != -1;
    }

    function newFolder(filename,succeed,fail) {
        server_request('/file/'+filename+'/',
                       {action: 'folder'},
                       function(response){
                           if (response._error) {
                               if (fail) fail(response._error);
                           } else {
                               if (saved_folder_list.indexOf(filename) == -1)
                                   saved_folder_list.push(filename);
                               succeed();
                           }
                       });
    }

    function isFile(filename) {
        return saved_file_list.indexOf(filename) != -1;
    }

    function newFile(filename,contents,succeed,fail) {
        server_request('/file/'+filename,
                       {action: 'save',contents: contents},
                       function(response){
                           if (response._error) {
                               if (fail) fail(response._error);
                           } else {
                               if (saved_file_list.indexOf(filename) == -1)
                                   saved_file_list.push(filename);
                               succeed({name: filename, data: contents});
                           }
                       });
    }

    function deleteFile(filename,succeed,fail) {
        server_request('/file/'+filename,
                       {action: 'delete'},
                       function(response){
                           if (response._error) {
                               if (fail) fail(response._error);
                           } else {
                               var index = saved_file_list.indexOf(filename);
                               if (index != -1) saved_file_list.splice(index,1);
                               succeed();
                           }
                       });
    }

    function renameFile(old_filename,new_filename,succeed,fail) {
        server_request('/file/'+old_filename,
                       {action: 'rename',path: new_filename},
                       function(response){
                           if (response._error) {
                               if (fail) fail(response._error);
                           } else {
                               var index = saved_file_list.indexOf(old_filename);
                               if (index != -1) saved_file_list.splice(index,1);

                               index = saved_file_list.indexOf(new_filename);
                               if (index == -1) saved_file_list.push(new_filename);

                               // finish up by returning contents of new file
                               getFile(new_filename,succeed,fail);
                           }
                       });
    }

    function getFile(filename,succeed,fail) {
        if (filename.match(/^\/shared/))
            shared_request(filename,'text',function(response) {
                succeed({name: filename, data: response, shared: true});
            },fail);
        else server_request('/file/'+filename,
                            {action: 'load'},
                            function(response){
                                if (response._error) {
                                    if (fail) fail(response._error);
                                } else {
                                    succeed({name: filename,
                                             data: response.file,
                                             autosave: response.autosave,
                                             shared: false});
                                }
                            });
    }

    function getBackup(filename,succeed,fail) {
        server_request('/file/'+filename,
                       {action: 'load'},
                       function(response){
                           if (response._error || response.backup === undefined) {
                               if (fail) fail(response._error);
                           } else succeed({name: filename, data: response.backup});
                       });
    }

    function makeAutoSave(filename,contents,succeed,fail) {
        server_request('/file/'+filename,
                       {action: 'autosave',contents: contents},
                       function(response){
                           if (response._error) {
                               if (fail) fail(response._error);
                           } else succeed({name: filename, data: contents});
                       });
    }

    function saveFile(filename,contents,succeed,fail) {
        server_request('/file/'+filename,
                       {action: 'save',contents: contents},
                       function(response){
                           if (response._error) {
                               if (fail) fail(response._error);
                           } else succeed({name: filename, data: contents});
                       });
    }

    function downloadZipURL() {
        // we support various servers during development
        var host = $(location).attr('host');
        if (host == 'localhost') {
            return local_server_url+'/file?action=zip'
        }
        else if (host == '6004.mit.edu') {
            return mit_server_url+'?_path=/file&action=zip';
        }
        else {
            return server_url+'/file?action=zip'
        }
    }

    return {getFileList: getFileList,
            getSharedFileList: getSharedFileList,
            getUserName: getUserName,

            isFolder: isFolder,
            newFolder: newFolder,

            isFile: isFile,
            newFile: newFile,
            deleteFile: deleteFile,
            renameFile: renameFile,

            getBackup: getBackup,
            getFile: getFile,
            makeAutoSave: makeAutoSave,
            saveFile: saveFile,

            downloadZipURL: downloadZipURL
           };
}());
