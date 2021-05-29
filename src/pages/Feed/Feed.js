import React, { Component, Fragment } from 'react';
import openSocket from "socket.io-client";

import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import './Feed.css';
import { API_URL } from '../../constants';

class Feed extends Component {
  state = {
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: '',
    postPage: 1,
    postsLoading: true,
    editLoading: false
  };

  componentDidMount() {
    const graphqlQuery = {
      query: `
        query getUser {
          user {
            _id
            status
          }
        }
      `,
    };
    fetch(`${API_URL}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.props.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        const errorStatusCode =
          resData.errors &&
          resData.errors[0] &&
          resData.errors[0].statusCode;
        if (errorStatusCode === 401 || errorStatusCode === 404) {
          const error = resData.errors[0].message;
          throw new Error(`Could not get user data. ${error}`);
        }
        if (resData.errors) {
          throw new Error("Could not get user data.")
        }
        this.setState({ status: resData.data.user.status });
      })
      .catch(this.catchError);
    this.loadPosts();
    const socket = openSocket("ws://localhost:8080", {
      "transports" : ["websocket"]
    });
    socket.on("posts", (data) => {
      if (data.action === "create") {
        this.addPost(data.post);
      } else if (data.action === "update") {
        this.updatePost(data.post);
      } else if (data.action === "delete") {
        this.deletePost(data.post._id);
      }
    });
  }

  addPost = post => {
    this.setState(prevState => {
      const updatedPosts = [...prevState.posts];
      if (prevState.postPage === 1) {
        if (prevState.posts.length >= 2) {
          updatedPosts.pop();
        }
        updatedPosts.unshift(post);
      }
      return {
        posts: updatedPosts,
        totalPosts: prevState.totalPosts + 1
      };
    });
  }
  
  updatePost = post => {
    this.setState(prevState => {
      const updatedPosts = [...prevState.posts];
      const updatedPostIndex = updatedPosts.findIndex(p => p._id === post._id);
      if (updatedPostIndex > -1) {
        updatedPosts[updatedPostIndex] = post;
      }
      return {
        posts: updatedPosts
      };
    });
  };

  deletePost = postId => {
    this.setState(prevState => {
      const updatedPosts = prevState.posts.filter(p => p._id !== postId);
      return { posts: updatedPosts };
    });
  }

  loadPosts = direction => {
    if (direction) {
      this.setState({ postsLoading: true, posts: [] });
    }
    let page = this.state.postPage;
    if (direction === 'next') {
      page++;
      this.setState({ postPage: page });
    }
    if (direction === 'previous') {
      page--;
      this.setState({ postPage: page });
    }
    const graphqlQuery = {
      query: `
        query getPosts($page: Int) {
          posts(page: $page) {
            posts {
              _id
              title
              content
              imageUrl
              createdAt
              creator {
                name
              }
            }
            totalItems
          }
        }
      `,
      variables: {
        page,
      },
    };
    fetch(`${API_URL}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.props.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        const errorStatusCode =
          resData.errors &&
          resData.errors[0] &&
          resData.errors[0].statusCode;
        if (errorStatusCode === 401) {
          throw new Error(`Could not fetch posts. ${resData.errors[0].message}`);
        }
        if (resData.errors) {
          throw new Error("Could not fetch posts.")
        }
        const posts = resData.data.posts.posts.map((post) => ({
          ...post,
          imagePath: post.imageUrl,
        }));
        this.setState({
          posts,
          totalPosts: resData.data.posts.totalItems,
          postsLoading: false
        });
      })
      .catch(this.catchError);
  };

  statusUpdateHandler = event => {
    event.preventDefault();
    const graphqlQuery = {
      query: `
        mutation updateStatus($status: String!) {
          updateStatus(status: $status) {
            _id
            status
          }
        }
      `,
      variables: {
        status: this.state.status,
      },
    };
    fetch(`${API_URL}/graphql`, {
      headers: {
        Authorization: `Bearer ${this.props.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
      method: "POST",
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        const errorStatusCode =
          resData.errors &&
          resData.errors[0] &&
          resData.errors[0].statusCode;
        if (
          errorStatusCode === 401 ||
          errorStatusCode === 404
        ) {
          const error = resData.errors[0].message;
          throw new Error(`Creating or editing a post failed. ${error}`);
        }
        if (resData.errors) {
          throw new Error("Could not create or edit post.");
        }
      })
      .catch(this.catchError);
  };

  newPostHandler = () => {
    this.setState({ isEditing: true });
  };

  startEditPostHandler = postId => {
    this.setState(prevState => {
      const loadedPost = { ...prevState.posts.find(p => p._id === postId) };

      return {
        isEditing: true,
        editPost: loadedPost
      };
    });
  };

  cancelEditHandler = () => {
    this.setState({ isEditing: false, editPost: null });
  };

  finishEditHandler = postData => {
    this.setState({
      editLoading: true
    });
    const formData = new FormData();
    formData.append("image", postData.image);

    if (this.state.editPost) {
      formData.append("oldPath", this.state.editPost.imageUrl);
    }

    fetch(`${API_URL}/post-image`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.props.token}`,
      },
      body: formData,
    })
    .then((response) => {
      return response.json();
    })
    .then(({ filePath: imageUrl }) => {
      let graphqlQuery;
      if (this.state.editPost) {
        graphqlQuery = {
          query: `
            mutation updatePost($input: PostInput!, $id: ID!) {
              updatePost(input: $input, id: $id) {
                _id
                title
                content
                imageUrl
                createdAt
                creator {
                  name
                }
              }
            }
          `,
          variables: {
            input: {
              title: postData.title,
              content: postData.content,
              imageUrl,
            },
            id: this.state.editPost._id,
          },
        };
      } else {
        graphqlQuery = {
          query: `
            mutation createPost($input: PostInput!) {
              createPost(input: $input) {
                _id
                title
                content
                imageUrl
                createdAt
                creator {
                  name
                }
              }
            }
          `,
          variables: {
            input: {
              title: postData.title,
              content: postData.content,
              imageUrl,
            },
          },
        };
      }
      return fetch(`${API_URL}/graphql`, {
        method: "POST",
        body: JSON.stringify(graphqlQuery),
        headers: {
          Authorization: `Bearer ${this.props.token}`,
          "Content-Type": "application/json",
        },
      })
    })
    .then(res => {
      return res.json();
    })
    .then((resData) => {
      const errorStatusCode =
        resData.errors &&
        resData.errors[0] &&
        resData.errors[0].statusCode;
      if (errorStatusCode === 422) {
        const [error] = resData.errors[0].errorList[0];
        throw new Error(`Creating or editing a post failed. ${error}`);
      }
      if (
        errorStatusCode === 401 ||
        errorStatusCode === 403 ||
        errorStatusCode === 404
      ) {
        const error = resData.errors[0].message;
        throw new Error(`Creating or editing a post failed. ${error}`);
      }
      if (resData.errors) {
        throw new Error("Could not create or edit post.");
      }
      this.setState({
        isEditing: false,
        editPost: null,
        editLoading: false
      });
    })
    .catch(err => {
      console.log(err);
      this.setState({
        isEditing: false,
        editPost: null,
        editLoading: false,
        error: err
      });
    });
  };

  statusInputChangeHandler = (input, value) => {
    this.setState({ status: value });
  };

  deletePostHandler = postId => {
    this.setState({ postsLoading: true });
    const url = `${API_URL}/graphql`;
    const graphqlQuery = {
      query: `
        mutation deletePost($id: ID!) {
          deletePost(id: $id) {
            _id
          }
        }
      `,
      variables: {
        id: postId,
      },
    };
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.props.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        const errorStatusCode =
          resData.errors &&
          resData.errors[0] &&
          resData.errors[0].statusCode;
        if (
          errorStatusCode === 401 ||
          errorStatusCode === 403 ||
          errorStatusCode === 404
        ) {
          const error = resData.errors[0].message;
          throw new Error(`Post deletion failed. ${error}`);
        }
        if (resData.errors) {
          throw new Error("Could not delete post.")
        }
        this.setState(prevState => {
          const updatedPosts = prevState.posts.filter(p => p._id !== postId);
          return { posts: updatedPosts, postsLoading: false };
        });
      })
      .catch(err => {
        console.log(err);
        this.setState({ postsLoading: false });
      });
  };

  errorHandler = () => {
    this.setState({ error: null });
  };

  catchError = error => {
    this.setState({ error: error });
  };

  render() {
    return (
      <Fragment>
        <ErrorHandler error={this.state.error} onHandle={this.errorHandler} />
        <FeedEdit
          editing={this.state.isEditing}
          selectedPost={this.state.editPost}
          loading={this.state.editLoading}
          onCancelEdit={this.cancelEditHandler}
          onFinishEdit={this.finishEditHandler}
        />
        <section className="feed__status">
          <form onSubmit={this.statusUpdateHandler}>
            <Input
              type="text"
              placeholder="Your status"
              control="input"
              onChange={this.statusInputChangeHandler}
              value={this.state.status}
            />
            <Button mode="flat" type="submit">
              Update
            </Button>
          </form>
        </section>
        <section className="feed__control">
          <Button mode="raised" design="accent" onClick={this.newPostHandler}>
            New Post
          </Button>
        </section>
        <section className="feed">
          {this.state.postsLoading && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Loader />
            </div>
          )}
          {this.state.posts.length <= 0 && !this.state.postsLoading ? (
            <p style={{ textAlign: 'center' }}>No posts found.</p>
          ) : null}
          {!this.state.postsLoading && (
            <Paginator
              onPrevious={this.loadPosts.bind(this, 'previous')}
              onNext={this.loadPosts.bind(this, 'next')}
              lastPage={Math.ceil(this.state.totalPosts / 2)}
              currentPage={this.state.postPage}
            >
              {this.state.posts.map(post => (
                <Post
                  key={post._id}
                  id={post._id}
                  author={post.creator.name}
                  date={new Date(post.createdAt).toLocaleDateString('en-US')}
                  title={post.title}
                  image={post.imageUrl}
                  content={post.content}
                  onStartEdit={this.startEditPostHandler.bind(this, post._id)}
                  onDelete={this.deletePostHandler.bind(this, post._id)}
                />
              ))}
            </Paginator>
          )}
        </section>
      </Fragment>
    );
  }
}

export default Feed;
